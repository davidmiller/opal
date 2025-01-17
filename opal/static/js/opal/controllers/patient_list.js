angular.module('opal.controllers').controller(
    'PatientListCtrl', function($scope, $q, $http, $cookieStore,
                                $location, $routeParams,
                                $modal, $rootScope,
                                $window,
                                growl,
                                Flow, Item,
                                Episode, episodedata, options,
                                profile, episodeVisibility){

        $scope.ready = false;
        var version = window.version;

        if(episodedata.status == 'error'){
            if($cookieStore.get('opal.lastPatientList')){
                $cookieStore.remove('opal.lastPatientList');
                $location.path('/list/')
                return
            }
            $location.path('/404');
            return
        }else{
            $scope.episodes = episodedata.data;
            $rootScope.state = 'normal';
            $scope.url = $location.url();

            $scope.options = options;
            $scope.listView = true;

            $scope.num_episodes = _.keys($scope.episodes).length;

	        $scope.rix = 0; // row index
            $scope._ =  _;

  	        $scope.query = {
              hospital_number: '', first_name: '', surname: '', ward: '', bed: ''
            };
            $scope.$location = $location;
            $scope.path_base = '/list/';
            $scope.profile = profile;

            $cookieStore.put('opal.lastPatientList', $routeParams.slug);
            var tags = $routeParams.slug.split('-')
            $scope.currentTag = tags[0];
            $scope.currentSubTag = tags.length == 2 ? tags[1] : "" ;
            $scope.tag_display = options.tag_display;
        }

	    $scope.getVisibleEpisodes = function() {
		    var visibleEpisodes = [];
            var episode_list = [];

            visibleEpisodes = _.filter($scope.episodes, function(episode){
                return episodeVisibility(episode, $scope);
            });
		    visibleEpisodes.sort(compareEpisodes);
            if($scope.rows && visibleEpisodes.length == 1){
                rix = getRowIxFromEpisodeId(visibleEpisodes[0].id);
                $scope.select_episode(visibleEpisodes[0], rix);
            }
		    return visibleEpisodes;
	    };

	    $scope.rows = $scope.getVisibleEpisodes();
        $scope.episode = $scope.rows[0];

        $scope.ready = true;

        //
        // This is used to be callable we can pass to
        // the table row iterator in the spreadsheet template.
        //
        $scope.isSelectedEpisode = function(episode){
            return episode === $scope.episode;
        }

	    function compareEpisodes(p1, p2) {
		    return p1.compare(p2);
	    };

        $scope.jumpToTag = function(tag){
            if(_.contains(_.keys(options.tag_hierarchy), tag)){
                $location.path($scope.path_base + tag)
            }else{
                for(var prop in options.tag_hierarchy){
                    if(options.tag_hierarchy.hasOwnProperty(prop)){
                        if(_.contains(_.values(options.tag_hierarchy[prop]), tag)){
                            $location.path($scope.path_base + prop + '-' + tag)
                        }
                    }
                }
            };
        }

	    $scope.$watch('query.hospital_number', function() {
		    $scope.rows = $scope.getVisibleEpisodes();
	    });

	    $scope.$watch('query.ward', function() {
		    $scope.rows = $scope.getVisibleEpisodes();
	    });

	    $scope.$watch('query.bed', function() {
		    $scope.rows = $scope.getVisibleEpisodes();
	    });

	    $scope.$watch('query.name', function() {
		    $scope.rows = $scope.getVisibleEpisodes();
	    });

	    $scope.$on('keydown', function(event, e) {
		    if ($rootScope.state == 'normal') {
			    switch (e.keyCode) {
                case 191: // question mark
                    if(e.shiftKey){
                        $scope.keyboard_shortcuts();
                    }
                    break;
                case 13:
                    if(profile.can_see_pid()){
                        $location.url($scope.episode.link);
                    }
                    break;
    			case 38: // up
    				goUp();
    				break;
    			case 40: // down
    				goDown();
    				break;
                case 78: // n
                    $scope.addEpisode();
    		    }
            }
	    });

        $scope.$on('change', function(event, episode) {
            episode = new Episode(episode);
            if($scope.episodes[episode.id]){
                $scope.episodes[episode.id] = episode;
                var rix = getRowIxFromEpisodeId(episode.id);
                if(rix != -1){
                    $scope.rows[rix] = episode;
                }
            }
        });

	    function getRowIxFromEpisodeId(episodeId) {
		    for (var rix = 0; rix < $scope.rows.length; rix++) {
			    if ($scope.rows[rix].id == episodeId) {
				    return rix;
			    }
		    };
		    return -1;
	    };

	    function getEpisode(rix) {
		    return $scope.rows[rix];
	    };

	    $scope.print = function() {
		    $window.print();
	    };

	    $scope.focusOnQuery = function() {
		    $rootScope.state = 'search';
	    };

	    $scope.blurOnQuery = function() {
		    $rootScope.state = 'normal';
	    };

	    $scope.addEpisode = function() {
            if(profile.readonly){ return null; };

            var enter = Flow.enter(
                options,
                {
                    current_tags: {
                        tag: $scope.currentTag,
                        subtag: $scope.currentSubTag
                    }
                }
            );

            $rootScope.state = 'modal';
            enter.then(
                function(resolved) {
		            // We have either retrieved an existing episode or created a new one,
                    // rendered a new modal for which we are waiting,
		            // or has cancelled the process at some point.

                    var return_to_normal = function(episode){
                    	// This ensures that the relevant episode is added to the table and
		                // selected.
		                var rowIx;
		                $rootScope.state = 'normal';
  		                if (episode && episode != 'cancel') {
                            //
                            // Occasionally the addPatient modal will add an episode to a list we're
                            // not currently on. So we check to see if they're tagged to this list.
                            //
                            if(episode.tagging[0][$scope.currentTag]){
                                if(!$scope.currentSubTag || episode.tagging[0][$scope.currentSubTag]){
  			                        $scope.episodes[episode.id] = episode;
  			                        $scope.rows = $scope.getVisibleEpisodes();
  			                        rowIx = getRowIxFromEpisodeId(episode.id);
                                    $scope.num_episodes += 1;
                                }
                            }
                            var readableName = $scope.tag_display[$scope.currentSubTag];
                            var msg = episode.demographics[0].first_name + " " + episode.demographics[0].surname;
                            msg += " added to the " + readableName + " list";
                            growl.success(msg);

  		                }
                    };
                    if(resolved.then){ // OMG - it's a promise!
                        resolved.then(
                            function(r){ return_to_normal(r) },
                            function(r){ return_to_normal(r) }
                        );
                    }else{
                        return_to_normal(resolved);
                    }
	            },
                function(reason){
                    // The modal has been dismissed. Practically speaking this means
                    // that the Angular UI called dismiss rather than our cancel()
                    // method on the OPAL controller. We just need to re-set in order
                    // to re-enable keybard listeners.
                    $rootScope.state = 'normal';
                });
	    };

        $scope._post_discharge = function(result, episode){
  			$rootScope.state = 'normal';
  			if (result == 'discharged' | result == 'moved') {
                delete $scope.episodes[episode.id];
  				$scope.rows = $scope.getVisibleEpisodes();
                $scope.num_episodes -= 1;
                $scope.rix = 0;
                $scope.episode = $scope.rows[0];
  			};
        };

	    $scope.dischargeEpisode = function(episode) {
            if(profile.readonly){ return null; };

		    $rootScope.state = 'modal';
            var exit = Flow.exit(episode, options,
                {
                    current_tags: {
                        tag   : $scope.currentTag,
                        subtag: $scope.currentSubTag
                    },
                }
            );

            exit.then(function(result) {
                //
                // Sometimes our Flow will open another modal - we wait for that
                // to close before firing the Post discharge hooks - this avoids the list
                // scope from trapping keystrokes etc
                //
                if(result && result.then){
                    result.then(function(r){ $scope._post_discharge(r, episode); });
                }else{
                    $scope._post_discharge(result, episode);
                }
		    });
	    };

        // TODO: Test This!
        $scope.removeFromMine = function(rix, event){
            if(profile.readonly){
                return null;
            };

            event.preventDefault();

            var modal;
            var episode = getEpisode(rix);
            var tagging = episode.tagging[0];
            editing = tagging.makeCopy();
            editing.mine = false;
            tagging.save(editing).then(function(result){
                $scope.rows = $scope.getVisibleEpisodes();
            })
        };

        $scope.newNamedItem = function(episode, name) {
            return episode.recordEditor.newItem(name);
        };

        $scope.is_tag_visible_in_list = function(tag){
            return _.contains(options.tag_visible_in_list, tag);
        };

        $scope.editNamedItem  = function(episode, name, iix) {
            var reset_state = function(result){
                if (name == 'tagging') {
                    // User may have removed current tag
                    $scope.rows = $scope.getVisibleEpisodes();
                }
                var item = _.last(episode[name]);

                if (episode[name].sort){
                    episode.sortColumn(item.columnName, item.sort);
                }
            };

            episode.recordEditor.editItem(name, iix).then(function(result){
                reset_state(result);
            });
        };

	    function goUp() {
		    var episode;
            if ($scope.rix > 0) {
			    $scope.rix--;
				$scope.episode = getEpisode($scope.rix);
		    };
	    };

	    function goDown() {
		    var episode = getEpisode($scope.rix);
            if ($scope.rix < $scope.rows.length - 1) {
			    $scope.rix++;
                $scope.episode = $scope.rows[$scope.rix];
		    };
	    };

        $scope.select_episode = function(episode, rix){
            if(rix == $scope.rix){
                return true;
            }else{
                $scope.episode = episode;
                $scope.rix = rix;
            }
            return true;
        }

        $scope.controller_for_episode = function(controller, template, size, episode){
            $modal.open({
                controller : controller,
                templateUrl: template,
                size       : size,
                resolve    : {
                    episode: function(){ return episode }
                }
            });
        }

        $scope.keyboard_shortcuts = function(){
            $modal.open({
                controller: "KeyBoardShortcutsCtrl",
                templateUrl: 'list_keyboard_shortcuts.html'
            })
        }
    });
