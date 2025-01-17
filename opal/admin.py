"""
Combined admin for OPAL models
"""
from django.contrib import admin
from django.contrib.contenttypes.admin import GenericTabularInline
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin

import reversion

from opal import models
from opal.models import Synonym
from opal.models import UserProfile
from opal.core.lookuplists import LookupList
from opal.core.subrecords import episode_subrecords, patient_subrecords

admin.site.unregister(User)

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    filter_horizontal = ('roles',)

class FilterInline(admin.StackedInline):
    model = models.Filter

class UserProfileAdmin(UserAdmin):
    inlines = [ UserProfileInline, FilterInline,]

class MyAdmin(reversion.VersionAdmin): pass

class EpisodeAdmin(reversion.VersionAdmin):
    list_display = ['patient', 'active', 'date_of_admission', 'discharge_date',]
    list_filter = ['active', ]
    search_fields = [
        'patient__demographics__first_name',
        'patient__demographics__surname',
        'patient__demographics__hospital_number'
    ]

class PatientAdmin(reversion.VersionAdmin):
    search_fields = [
        'demographics__first_name',
        'demographics__surname',
        'demographics__hospital_number'
    ]

class TaggingAdmin(reversion.VersionAdmin):
    list_display = ['value', 'episode']

# class TeamAdmin(reversion.VersionAdmin):
#     list_display = ['title', 'name', 'active', 'restricted', 'visible_in_list', 'direct_add', 'order']
#     search_fields = ['title']
#     list_editable = ['active', 'order', 'restricted', 'visible_in_list', 'direct_add']
#     filter_horizontal = ('useful_numbers',)


class PatientSubRecordAdmin(reversion.VersionAdmin):
    search_fields = [
        'patient__demographics__first_name',
        'patient__demographics__surname',
        'patient__demographics__hospital_number'
    ]


class EpisodeSubRecordAdmin(reversion.VersionAdmin):
    pass


class SynonymInline(GenericTabularInline):
    model = Synonym

class OptionAdmin(admin.ModelAdmin):
    ordering = ['name']
    search_fields = ['name']
    inlines = [SynonymInline]

for model in LookupList.__subclasses__():
    admin.site.register(model, OptionAdmin)

admin.site.register(User, UserProfileAdmin)
admin.site.register(models.Patient, PatientAdmin)
admin.site.register(models.Episode, EpisodeAdmin)
admin.site.register(models.Tagging, TaggingAdmin)

for subclass in patient_subrecords():
    if not subclass._meta.abstract and not getattr(subclass, "_no_admin", False):
        admin.site.register(subclass, PatientSubRecordAdmin)

for subclass in episode_subrecords():
    if not subclass._meta.abstract and not getattr(subclass, "_no_admin", False):
        admin.site.register(subclass, EpisodeSubRecordAdmin)

admin.site.register(models.GP, MyAdmin)
admin.site.register(models.CommunityNurse, MyAdmin)
admin.site.register(models.ContactNumber, MyAdmin)
#admin.site.register(models.Team, TeamAdmin)
admin.site.register(models.Role, MyAdmin)
admin.site.register(models.Macro, MyAdmin)
