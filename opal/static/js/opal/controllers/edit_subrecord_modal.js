angular.module('opal.controllers')
    .controller(
        'EditSubrecordModal',
        function($scope, $timeout, $modalInstance, $modal, $q,
                 ngProgressLite,
                 referencedata, metadata, profile, subrecord, episode) {

            "use strict";
            //
            // 1. Set up the variables we want on scope so we can use them
            // in templates, form widgets, et cetera.
            //
            $scope.metadata = metadata
            _.extend($scope, referencedata.toLookuplists());
            $scope.profile = profile;
            // We store the episode and the output of Episode.makeCopy() so that we can
            // manually track in this *controller* whether or not the episode has changed.
            // TODO: Don't do that. Make it part of episode.
            $scope.the_episode = episode;
            $scope.episode = episode.makeCopy();
            // Some fields should only be shown for certain categories.
            // Make that category available to the template.
            $scope.episode_category = subrecord.episode.category;
            $scope.columnName = subrecord.api_name; // TODO: Change columnName -> api_name
            // This is the patientname displayed in the modal header
  	        $scope.editingName = item.episode.demographics[0].first_name + ' '
            $scope.editingName += episode.demographics[0].surname;
            // TODO Make ^^ a function call of Episode

            //
            // 2. Set up the object we will be using to edit the data in this modal
            //
            $scope.editing = {};
            $scope.editing[item.api_name] = item.editing

            $scope.editingMode = function(){
                return !_.isUndefined(subrecord.id);
            };

            //
            // 3. Custom logic to ensure that Opal Macros work.
            // TODO: check that Opal Macros still work
            //
            $scope.macros = metadata.macros;
            $scope.select_macro = function(item){
                return item.expanded;
            };

            //
            // 4. Begin CRUD Funcitons for this modal that can be called from templates
            // so that users can have CRUD buttons.
            //

            $scope.delete = function(result){
                $modalInstance.close(result);
                var modal = $modal.open({
                    templateUrl: '/templates/modals/delete_subrecord_confirmation.html/',
                    // TODO: Implement this confirmation Modal for subrecords rather than Items
                    controller: 'DeleteSubrecordConfirmationCtrl',
                    resolve: {
                        subrecord: function() { return subrecord; }
                    }
                });
            };

            $scope.preSave = function(editing){};

	        $scope.save = function(result) {
                ngProgressLite.set(0);
                ngProgressLite.start();
                $scope.preSave($scope.editing);
                var wait_on = [subrecord.save()];
                if(!angular.equals($scope.the_episode.makeCopy(), $scope.episode)){
                    wait_on.push($scope.the_episode.save($scope.episode));
                }

                $q.all(wait_on).then(function() {
                    ngProgressLite.done();
      			    $modalInstance.close(result);
		        });
	        };

            // Let's have a nice way to kill the modal.
	        $scope.cancel = function() {
		        $modalInstance.close('cancel');
	        };

        });
