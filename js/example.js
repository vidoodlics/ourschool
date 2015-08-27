var myapp = angular.module('myapp', []).config(function ($routeProvider) {
    $routeProvider.when('/list', {
        templateUrl: '/list.html'
    }).when('/detail/:id/', {
        templateUrl: '/detail.html',
        controller: 'DetailCtrl',
        resolve: {
            load: function ($route, dataService) {
                return dataService.load($route.current.params.id);
            }
        }
    }).otherwise({
        redirectTo: '/list'
    });
});
myapp.controller('DetailCtrl', function ($scope, $location, dataService) {
    $scope.data = dataService.data;
    $scope.back = function () {
        $location.path('/list');
    };
});
myapp.factory('dataService', function ($q, $timeout) {
    return { 
        data : {},
        load : function(id) {
            var defer = $q.defer();
            var data = this.data;
            $timeout(function () {
                data.id = id;
                defer.resolve(data);
            }, 1000);
            return defer.promise;
        }
    };
});