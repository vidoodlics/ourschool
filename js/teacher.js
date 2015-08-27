var teachers = angular.module( 'teachers', [ 'ngRoute', 'ui.bootstrap', 'angularAwesomeSlider', 'controllers' ] );

teachers.config( [ '$routeProvider', function ( $routeProvider ) { 
	// Route configuration
	$routeProvider.
		when( '/dashboard', { templateUrl: '/views/partials/dashboard.html' } ).
		when( '/album', { 
			templateUrl: 'application/teachers/views/partials/album.html',
			controller: 'AlbumCtrl' } ).
		when( '/new', { 
			templateUrl: '/views/partials/lesson.html', 
			controller: 'LessonCtrl',
			resolve: {
				lesson: function ( TranslationService ) {
					return { descr: TranslationService.literals.NEW }
				}
			}
		} ).
		when( '/depts', { templateUrl: 'application/teachers/views/partials/depts.html' } ).
		when( '/contact', { 
			templateUrl: 'application/teachers/views/partials/contact.html',
			controller: 'ContactCtrl' } ).
		otherwise( {
			redirectTo: '/dashboard' } );
} ] );

teachers.controller( 'TeachersCtrl', [ '$scope', 'TranslationService', function ( $scope, i18n ) {
	$scope.language = 'el';
	$scope.isCollapsed = false;
	$scope.teacher = teacher;
	$scope.lessons = teacher.lessons;
	i18n.setLanguage( $scope.language );
	$scope.i18n = i18n;
	$scope.$watch( 'language', function ( newValue, oldValue ) {
		i18n.setLanguage( newValue );
	} );
} ] );

teachers.service( 'TranslationService', function ( $http, $log ) {
	this.setLanguage = function( lang ) {
		this.current = lang;
		var that = this;
		var languageFilePath = '/translations/' + lang + '.json';
		$http.get( languageFilePath ).success( function ( data ) {
			that.literals = data;
		} );
	};
} );