angular.module('opal.services')
    .service('UserProfile', function($q, $http, $window, $routeParams, $log) {
        var UserProfile = function(profiledata){
            var profile = this;

            angular.extend(profile, profiledata);
        };

        var load = function(){
          var deferred = $q.defer();

          url = '/api/v0.1/userprofile/';

          $http({ cache: true, url: url, method: 'GET'}).then(function(response) {
            deferred.resolve(new UserProfile(response.data) );
          }, function() {
            // handle error better
            $window.alert('UserProfile could not be loaded');
          });

          return deferred.promise;
        };

        return {
          load: load
        };
    });
