function Error(message){
    this.name    = 'Error';
    this.message = message;
}

angular.module('opal.services')
    .factory('Subrecord', function($http, $resource, $rootScope, $q, $window){
        "use strict";

        var Subrecord = function(api_name, initial_data, episode){
            this.api_name     = api_name;
            this.initial_data = initial_data;
            this.episode      = episode;
            this.api_base_url = '/api/v0.1/' + this.api_name + '/';
            this.cid          = _.uniqueId(this.api_name);
            this.schema       = $rootScope.fields[this.api_name];
            this.initialize(initial_data);
        }

        Subrecord.prototype = {

            initialize: function(data){
                var self = this;
                if(data){
                    angular.extend(self, data)
                    self.editing = angular.copy(data);
                }
            },

            save: function(){
                var self = this;
                var method, url;
                var deferred = $q.defer();

                if(angular.isDefined(self.id)){
                    method = 'put';
                    url    = self.api_base_url + self.id + '/';
                }else{
                    method = 'post';
                    url    = self.api_base_url;
                    if(!self.episode_id){
                        if(self.episode){
                            self.episode_id = self.episode.id;
                        }else{
                            throw new Error("Can't find the Episode this subrecord relates to");
                        }
                    }
                }
                $http[method](url, self.editing).then(
                    function(response){
                        self.initialize(response.data);
                        if(method == 'post' && self.episode){
                            self.episode.addItem(item);
                        }
                        deferred.resolve();
                    },
                    function(response){
                        if (response.status == 409) {
                            $window.alert('Record could not be saved because somebody else has \
recently changed it - refresh the page and try again');
                        } else {
                            $window.alert('Record could not be saved');
                        };
                        deferred.reject();
                    });

                return deferred.promise;
            },

            destroy: function(){

            }

        };

        return Subrecord
    });
