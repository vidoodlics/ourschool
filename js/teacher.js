var teachers = angular.module( 'teachers', [ 'ngRoute', 'ui.bootstrap', 'angularAwesomeSlider', 'lessons', 'album' ] );

teachers.run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
  var original = $location.path;
  $location.path = function (path, reload) {
    if (reload === false) {
      var lastRoute = $route.current;
      var un = $rootScope.$on('$locationChangeSuccess', function () {
        $route.current = lastRoute;
        un();
      });
    }
    return original.apply($location, [path]);
  };
} ] );

teachers.config( [ '$httpProvider', '$routeProvider', function ( $httpProvider, $routeProvider ) {
	// Use x-www-form-urlencoded Content-Type
	$httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
  $httpProvider.defaults.headers.put['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

	/**
	 * The workhorse; converts an object to x-www-form-urlencoded serialization.
	 * @param {Object} obj
	 * @return {String}
	 */
	var param = function( obj ) {
		var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

	  for( name in obj ) {
      value = obj[ name ];

      if( value instanceof Array ) {
        for( i=0; i<value.length; ++i ) {
          subValue = value[ i ];
          fullSubName = name + '[' + i + ']';
          innerObj = {};
          innerObj[ fullSubName ] = subValue;
          query += param( innerObj ) + '&';
        }
      } else if( value instanceof Object ) {
        for( subName in value ) {
          subValue = value[ subName ];
          fullSubName = name + '[' + subName + ']';
          innerObj = {};
          innerObj[ fullSubName ] = subValue;
          query += param( innerObj ) + '&';
        }
      } else if( value !== undefined && value !== null )
        query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
	  }

	  return query.length ? query.substr(0, query.length - 1) : query;
	};
	// Override $http service's default transformRequest
	$httpProvider.defaults.transformRequest = [ function( data ) {
		return angular.isObject( data ) && String( data ) !== '[object File]' ? param( data ) : data;
	} ];

	// Route configuration
	$routeProvider.
    when( '/', {
      templateUrl: '/views/partials/dashboard.html',
      controller: 'TeacherStatistics',
      resolve: {
        statistics: function ( StatisticsSvc ) {
          return StatisticsSvc.teacher();
        }
      }
    } ).
		when( '/album', {
			templateUrl: '/views/partials/album.html',
      controllerAs: 't,st',
			controller: 'AlbumCtrl' } ).
    when( '/lessons', {
			templateUrl: '/views/partials/lesson.html',
			controller: 'LessonCtrl',
			resolve: {
        video: function ( VideoPlayerSvc ) {
          return VideoPlayerSvc.init;
        },
				lesson: function ( LessonSvc ) {
          return LessonSvc.newLesson();
				}
			}
		} ).
    when( '/lessons/:lessonID', {
			templateUrl: '/views/partials/lesson.html',
			controller: 'LessonCtrl',
			resolve: {
        video: function ( VideoPlayerSvc ) {
          return VideoPlayerSvc.init;
        },
        lesson: function ( $route, LessonSvc ) {
          return LessonSvc.getLesson( $route.current.params.lessonID );
        }
			}
		} ).
    when( '/lessons/:lessonID/statistics', {
			templateUrl: '/views/partials/lessonstats.html',
			controller: 'LessonStatistics',
			resolve: {
        video: function ( VideoPlayerSvc ) {
          return VideoPlayerSvc.init;
        },
        lesson: function ( $route, LessonSvc ) {
          return LessonSvc.getLesson( $route.current.params.lessonID );
        },
        statistics: function ( $route, StatisticsSvc ) {
          return StatisticsSvc.lesson( $route.current.params.lessonID );
        }
			}
		} ).
    when( '/lessons/:lessonID/students_statistics', {
			templateUrl: function ( param ) {
        return '/teachers/' + teacher_id + '/lessons/' + param.lessonID + '/students_statistics';
      },
			controller: 'StudentsStatistics',
		} ).
    when( '/lessons/:lessonID/students_statistics/:studentID', {
			templateUrl: function ( param ) {
        return '/teachers/' + teacher_id + '/lessons/' + param.lessonID + '/students_statistics/' + param.studentID;
      },
			controller: 'StudentStatistics',
			resolve: {
        video: function ( VideoPlayerSvc ) {
          return VideoPlayerSvc.init;
        },
        lesson: function ( $route, LessonSvc ) {
          return LessonSvc.getLesson( $route.current.params.lessonID );
        },
        statistics: function ( $route, StatisticsSvc ) {
          return StatisticsSvc.student( $route.current.params.lessonID, $route.current.params.studentID );
        }
			}
		} ).
		when( '/depts', { templateUrl: 'application/teachers/views/partials/depts.html' } ).
		when( '/contact', {
			templateUrl: 'application/teachers/views/partials/contact.html',
			controller: 'ContactCtrl' } ).
		otherwise( {
			redirectTo: '/' } );
} ] );

teachers.controller( 'TeachersCtrl', [ '$scope', 'TranslationService', 'VideoPlayerSvc', 'LessonSvc', '$location', '$modal', '$log',
                                      function ( $scope, i18n, VideoPlayerSvc, LessonSvc, $location, $modal, $log ) {
  var pathre = /lessons/;
  $scope.language = 'el';
	$scope.isCollapsed = false;
	$scope.teacher = teacher;
	$scope.lessons = teacher.lessons;
	$scope.i18n = i18n;
  $scope.video = VideoPlayerSvc;
  $scope.loc = $location;
	$scope.$watch( 'language', function ( newValue, oldValue ) {
		i18n.setLanguage( newValue );
	} );
  $scope.editLesson = function ( event, id ) {
    event.preventDefault();
    event.stopPropagation();
    if ( !pathre.test( $location.path() ) ) {
      $location.path( '/lessons/' + id );
    } else {
      if ( $location.path().search( /statistics/ ) != -1 ) {
        $location.path( '/lessons/' + id );
      } else {
        $scope.$broadcast( 'lessonChange', id );
      }
    }
  };
  $scope.removeLesson = function ( event, lesson, index ) {
    event.preventDefault();
    event.stopPropagation();
    var modalInstance = $modal.open( {
      templateUrl: 'lconfirmation.html',
      controller: 'LesnConfirmationCtrl',
      resolve: {
        'lesson': function () {
          return lesson;
        }
      }
    } );
    modalInstance.result.then( function () {
      LessonSvc.delLesson( lesson.id ).then( function () {
        $scope.lessons.splice( index, 1 );
      } );
    } );
  };
  $scope.checkPath = function ( path ) {
    var pathArray = path.split('/');
    var locArray = $location.path().split('/');
    ret = '';
    if ( pathArray.length == 2 && locArray.length == 2 ) {
      if ( pathArray[ 1 ] == locArray[ 1 ] ) {
        ret = 'active';
      }
    } else if ( pathArray[ 2 ] == locArray[ 2 ] ) {
       ret = 'active';
    }
    return ret;
  };
  $scope.$on( 'lessonUpdate', function ( event, lesson ) {
    for ( var i = 0; i < $scope.lessons.length; i++ ) {
      if ( $scope.lessons[i].id == lesson.id ) {
        $scope.lessons[ i ].descr = lesson.descr;
        break;
      }
    }
  } );
} ] );

teachers.controller( 'LesnConfirmationCtrl', [ '$scope', '$modalInstance', 'lesson', 'TranslationService', function ( $scope, $modalInstance, lesson, i18n ) {
  $scope.i18n = i18n;
  $scope.lesson = lesson;
  $scope.ok = function () {
    $modalInstance.close();
  };
  $scope.cancel = function () {
    $modalInstance.dismiss();
  };
} ] );

teachers.controller( 'TeacherStatistics', [ '$scope', 'statistics', function ( $scope, statistics ) {
  $scope.stats = statistics;
} ] );

teachers.service( 'TranslationService', function ( $http, $log ) {
  this.current = 'el';
  this.init = $http.get( '/translations/el.json' ).success( function ( data ) {
    this.literals = data;
  } );
	this.setLanguage = function( lang ) {
		this.current = lang;
		var that = this;
		var languageFilePath = '/translations/' + lang + '.json';
		$http.get( languageFilePath ).success( function ( data ) {
			that.literals = data;
		} );
	};
} );

teachers.service( 'StatisticsSvc', function ( $http ) {
  this.teacher = function () {
    var uri = '/teachers/' + teacher_id + '/statistics';
    return $http.get( uri ).then( function ( response ) {
      return response.data;
    } );
  };
  this.lesson = function ( lessonID ) {
    var uri = '/teachers/' + teacher_id + '/lessons/' + lessonID + '/statistics';
    return $http.get( uri ).then( function ( response ) {
      return response.data;
    } );
  };
  this.students = function ( lessonID ) {
    var uri = '/teachers/' + teacher_id + '/lessons/' + lessonID + '/students_statistics';
    return $http.get( uri ).then( function ( response ) {
      return response.data;
    } );
  };
  this.student = function ( lessonID, studentID ) {
    var uri = '/teachers/' + teacher_id + '/lessons/' + lessonID + '/student_statistics/' + studentID;
    return $http.get( uri ).then( function ( response ) {
      return response.data;
    } );
  };
} );
