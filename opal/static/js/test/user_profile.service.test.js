describe('UserProfile', function(){
    "use strict";

    var $httpBackend, $window;
    var UserProfile, $rootScope;

    beforeEach(function(){
        module('opal.services');

        inject(function($injector){
            UserProfile    = $injector.get('UserProfile');
            $httpBackend   = $injector.get('$httpBackend');
            $rootScope     = $injector.get('$rootScope');
            $window        = $injector.get('$window');
        });

    });

    it('should alert if the HTTP request errors', function(){
        UserProfile.load();
        $httpBackend.expectGET('/api/v0.1/userprofile/').respond(500, 'NO');
        spyOn($window, 'alert');

        $rootScope.$apply();
        $httpBackend.flush();

        expect($window.alert).toHaveBeenCalledWith('UserProfile could not be loaded');
    });

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

});
