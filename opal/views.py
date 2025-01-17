"""
Module entrypoint for core OPAL views
"""
from django.conf import settings
from django.contrib.auth.views import login
from django.http import HttpResponseNotFound
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import select_template, get_template
from django.template import TemplateDoesNotExist
from django.views.generic import TemplateView, View
from django.views.decorators.http import require_http_methods

from opal import models
from opal.core import application, detail, episodes, exceptions, glossolalia
from opal.core.patient_lists import PatientList
from opal.core.subrecords import (
    episode_subrecords, subrecords, get_subrecord_from_api_name
)
from opal.core.views import LoginRequiredMixin, _get_request_data, _build_json_response
from opal.utils import camelcase_to_underscore, stringport
from opal.utils.banned_passwords import banned

app = application.get_app()

# TODO This is stupid - we can fully deprecate this please?
try:
    options = stringport(settings.OPAL_OPTIONS_MODULE)
    micro_test_defaults = options.micro_test_defaults
except AttributeError:
    class options:
        micro_test_defaults = []

Synonym = models.Synonym


class PatientListTemplateView(TemplateView):

    def dispatch(self, *args, **kwargs):
        try:
            self.patient_list = PatientList.get(kwargs['slug'])
        except ValueError:
            self.patient_list = None
        return super(PatientListTemplateView, self).dispatch(*args, **kwargs)

    def get_column_context(self, **kwargs):
        """
        Return the context for our columns
        """
        # we use this view to load blank tables without content for
        # the list redirect view, so if there are no kwargs, just
        # return an empty context
        if not self.patient_list:
            return []

        context = []
        slug = self.patient_list.get_slug()
        for column in self.patient_list.schema:
            column_context = {}
            name = camelcase_to_underscore(column.__name__)
            column_context['name'] = name
            column_context['title'] = getattr(column, '_title',
                                              name.replace('_', ' ').title())
            column_context['single'] = column._is_singleton
            column_context['icon'] = getattr(column, '_icon', '')
            column_context['list_limit'] = getattr(column, '_list_limit', None)
            column_context['template_path'] = column.get_display_template(patient_list=slug)
            column_context['detail_template_path'] = column.get_detail_template(patient_list=slug)
            context.append(column_context)

        return context

    def get_context_data(self, **kwargs):
        context = super(PatientListTemplateView, self).get_context_data(**kwargs)
        list_slug = None
        if self.patient_list:
            list_slug = self.patient_list.get_slug()
        context['list_slug'] = list_slug
        context['lists'] = PatientList.for_user(self.request.user)
        context['columns'] = self.get_column_context(**kwargs)
        return context

    def get_template_names(self):
        if self.patient_list:
            return self.patient_list().get_template_names()
        return [PatientList.template_name]

class PatientDetailTemplateView(TemplateView):
    template_name = 'patient_detail.html'

    def get_context_data(self, **kwargs):
        context = super(PatientDetailTemplateView, self).get_context_data(**kwargs)
        context['episode_types'] = episodes.episode_types()
        # We cast this to a list because it's a generator but we want to consume
        # it twice in the template
        context['detail_views'] = list(detail.PatientDetailView.for_user(self.request.user))
        return context

# TODO: ?Remove this ?
class EpisodeDetailTemplateView(TemplateView):
    def get(self, *args, **kwargs):
        self.episode = get_object_or_404(models.Episode, pk=kwargs['pk'])
        return super(EpisodeDetailTemplateView, self).get(*args, **kwargs)

    def get_template_names(self):
        names = ['detail/{0}.html'.format(self.episode.category.lower()), 'detail/default.html']
        return names

    def get_context_data(self, **kwargs):
        context = super(EpisodeDetailTemplateView, self).get_context_data(**kwargs)
        return context


class AddEpisodeTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'add_episode_modal.html'

    def get_context_data(self, **kwargs):
        context = super(AddEpisodeTemplateView, self).get_context_data(**kwargs)
        context['teams'] = models.Team.for_user(self.request.user)
        return context


class AddEpisodeWithoutTeamsTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'add_episode_modal.html'

    def get_context_data(self, **kwargs):
        context = super(AddEpisodeWithoutTeamsTemplateView, self).get_context_data(**kwargs)
        context['teams'] = []
        return context


class IndexView(LoginRequiredMixin, TemplateView):
    template_name = 'opal.html'

    def get_context_data(self, **kwargs):
        context = super(IndexView, self).get_context_data(**kwargs)
        context['brand_name'] = getattr(settings, 'OPAL_BRAND_NAME', 'OPAL')
        context['settings'] = settings
        if hasattr(settings, 'OPAL_EXTRA_APPLICATION'):
            context['extra_application'] = settings.OPAL_EXTRA_APPLICATION

        return context


def check_password_reset(request, *args, **kwargs):
    """
    Check to see if the user needs to reset their password
    """
    response = login(request, *args, **kwargs)
    if response.status_code == 302:
        try:
            profile = request.user.profile
            if profile and profile.force_password_change:
                return redirect(
                    'django.contrib.auth.views.password_change'
                )
        except models.UserProfile.DoesNotExist:
            # TODO: This probably doesn't do any harm, but
            # we should really never reach this. Creation
            # of profiles shouldn't happen in a random view.
            models.UserProfile.objects.create(
                user=request.user, force_password_change=True)
            return redirect(
                'django.contrib.auth.views.password_change'
            )
    return response


"""Internal (Legacy) API Views"""

#    TODO: Remove this
@require_http_methods(['GET', 'PUT'])
def episode_detail_view(request, pk):
    try:
        episode = models.Episode.objects.get(pk=pk)
    except models.Episode.DoesNotExist:
        return HttpResponseNotFound()

    if request.method == 'GET':
        serialized = episode.to_dict(request.user)
        return _build_json_response(serialized)

    data = _get_request_data(request)

    try:
        pre = episode.to_dict(request.user)
        episode.update_from_dict(data, request.user)
        post = episode.to_dict(request.user)
        glossolalia.change(pre, post)
        return _build_json_response(episode.to_dict(request.user, shallow=True))
    except exceptions.ConsistencyError:
        return _build_json_response({'error': 'Item has changed'}, 409)


# TODO: Remove this
@require_http_methods(['GET', 'POST'])
def episode_list_and_create_view(request):
    if request.method == 'GET':
        serialised = models.Episode.objects.serialised_active(request.user)
        return _build_json_response(serialised)

    elif request.method == 'POST':
        data = _get_request_data(request)
        hospital_number = data['demographics'].get('hospital_number')
        if hospital_number:
            patient, _ = models.Patient.objects.get_or_create(
                demographics__hospital_number=hospital_number)
        else:
            patient = models.Patient.objects.create()

        patient.update_from_demographics_dict(data['demographics'], request.user)
        try:
            episode = patient.create_episode()
            episode_fields = models.Episode._get_fieldnames_to_serialize()
            episode_data = {}
            for fname in episode_fields:
                if fname in data:
                    episode_data[fname] = data[fname]
            episode.update_from_dict(episode_data, request.user)

        except exceptions.APIError:
            return _build_json_response(
                {'error': 'Patient already has active episode'}, 400)

        location = episode.location_set.get()
        location.update_from_dict(data['location'], request.user)
        if 'tagging' in data:
            tag_names = [n for n, v in data['tagging'][0].items() if v]
            episode.set_tag_names(tag_names, request.user)

        serialised = episode.to_dict(request.user)
        glossolalia.admit(serialised)
        return _build_json_response(serialised, status_code=201)


class EpisodeCopyToCategoryView(LoginRequiredMixin, View):
    """
    Copy an episode to a given category, excluding tagging.
    """
    def post(self, args, pk=None, category=None, **kwargs):
        old = models.Episode.objects.get(pk=pk)
        new = models.Episode(patient=old.patient,
                             category=category,
                             date_of_admission=old.date_of_admission)
        new.save()
        for sub in episode_subrecords():
            if sub._is_singleton:
                continue
            for item in sub.objects.filter(episode=old):
                item.id = None
                item.episode = new
                item.save()
        serialised = new.to_dict(self.request.user)
        glossolalia.admit(serialised)
        return _build_json_response(serialised)

"""
Template views for OPAL
"""

class FormTemplateView(LoginRequiredMixin, TemplateView):
    """
    This view renders the form template for our field.

    These are generated for subrecords, but can also be used
    by plugins for other mdoels.
    """
    template_name = "form_base.html"

    def get_context_data(self, *args, **kwargs):
        ctx = super(FormTemplateView, self).get_context_data(*args, **kwargs)
        ctx["form_name"] = self.column.get_form_template()
        return ctx

    def dispatch(self, *a, **kw):
        """
        Set the context for what this modal is for so
        it can be accessed by all subsequent methods
        """
        self.column = kw['model']
        self.name = camelcase_to_underscore(self.column.__name__)
        return super(FormTemplateView, self).dispatch(*a, **kw)


class ModalTemplateView(LoginRequiredMixin, TemplateView):
    def get_template_from_model(self):
        return self.column.get_modal_template(
            patient_list=self.list_slug)


    def dispatch(self, *a, **kw):
        """
        Set the context for what this modal is for so
        it can be accessed by all subsequent methods
        """
        self.column = kw['model']
        self.list_slug = kw.get('list', None)
        self.template_name = self.get_template_from_model()
        self.name = camelcase_to_underscore(self.column.__name__)
        return super(ModalTemplateView, self).dispatch(*a, **kw)

    def get_context_data(self, **kwargs):
        context = super(ModalTemplateView, self).get_context_data(**kwargs)
        context['name'] = self.name
        context['title'] = getattr(self.column, '_title', self.name.replace('_', ' ').title())
        context['icon'] = getattr(self.column, '_icon', '')
        # pylint: disable=W0201
        context['single'] = self.column._is_singleton
        context["column"] = self.column

        return context


class RecordTemplateView(LoginRequiredMixin, TemplateView):
    def get_template_names(self):
        model = get_subrecord_from_api_name(self.kwargs["model"])
        template_name = model.get_modal_template()
        return [template_name]


class AccountDetailTemplateView(TemplateView):
    template_name = 'accounts/account_detail.html'


class BannedView(TemplateView):
    template_name = 'accounts/banned.html'

    def get_context_data(self, *a, **k):
        data = super(BannedView, self).get_context_data(*a, **k)
        data['banned'] = banned
        return data

class HospitalNumberTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'hospital_number_modal.html'


class ReopenEpisodeTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'reopen_episode_modal.html'


class UndischargeTemplateView(TemplateView):
    template_name = 'undischarge_modal.html'

class DischargeEpisodeTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'discharge_episode_modal.html'


class CopyToCategoryTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'copy_to_category.html'


class DeleteItemConfirmationView(LoginRequiredMixin, TemplateView):
    template_name = 'delete_item_confirmation_modal.html'


class RawTemplateView(TemplateView):
    """
    Failover view for templates - just look for this path in Django!
    """
    def dispatch(self, *args, **kw):
        self.template_name = kw['template_name']
        try:
            get_template(self.template_name)
        except TemplateDoesNotExist:
            return HttpResponseNotFound()
        return super(RawTemplateView, self).dispatch(*args, **kw)
