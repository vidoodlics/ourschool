var students = angular.module( 'students', [ 'ngRoute', 'ui.bootstrap', 'angularAwesomeSlider' ] );

students.run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
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

students.config( [ '$httpProvider', '$routeProvider', function ( $httpProvider, $routeProvider ) {
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
      templateUrl: 'teachers-list.html',
      controller: 'TeachersListCtrl',
      resolve: {
        teachers: function ( $http, $location ) {
          var re = /\.*\/students\/(\d+)#/;
          var result = re.exec( $location.absUrl() );
          var studentID = result[ 1 ];
          return $http.get( '/teachers?lessons=true&student=' + studentID ).then( function ( response ) {
            return response.data;
          } );
        }
      }
    } ).
    when( '/teachers/:teacherID/lessons', {
      templateUrl: 'lessons-list.html',
      controller: 'LessonsListCtrl',
      resolve: {
        lessons: function ( $route, $http, $location ) {
          var re = /\.*\/students\/(\d+)#/;
          var result = re.exec( $location.absUrl() );
          var studentID = result[ 1 ];
          var url = '/teachers/' + $route.current.params.teacherID + '/lessons?student=' + studentID;
          return $http.get( url ).then ( function ( response ) {
            return response.data;
          } );
        }
      }
    } ).
    when( '/teachers/:teacherID/lessons/:lessonID', {
			templateUrl: '/views/partials/lessonview.html',
			controller: 'LessonCtrl',
			resolve: {
        video: function ( VideoPlayerSvc ) {
          return VideoPlayerSvc.init;
        },
				lesson: function ( $route, $http ) {
          var url = '/teachers/' + $route.current.params.teacherID + '/lessons/' + $route.current.params.lessonID + '?student=true';
          return $http.get( url ).then ( function ( response ) {
            response.data.teacherID = $route.current.params.teacherID;
            response.data.lessonID = $route.current.params.lessonID;
            return response.data;
          } );
				}
			}
		} ).
		otherwise( {
			redirectTo: '/' } );
} ] );

students.controller( 'StudentsCtrl', [ '$scope', 'TranslationService', '$log', function ( $scope, i18n, $log ) {
  $scope.language = 'el';
  $scope.i18n = i18n;
	$scope.$watch( 'language', function ( newValue, oldValue ) {
		i18n.setLanguage( newValue );
	} );
} ] );

students.controller('TeachersListCtrl', [ '$scope', 'teachers', function ( $scope, teachers ) {
  $scope.teachers = teachers;
} ] );

students.controller('LessonsListCtrl', [ '$scope', 'lessons', function ( $scope, lessons ) {
  $scope.lessons = lessons;
} ] );

students.controller('LessonCtrl', [ '$scope', '$interval', 'VideoPlayerSvc', 'lesson', 'LessonSvc', '$location', '$log', function ( $scope, $interval, VideoSvc, lesson, LessonSvc, loc, $log ) {
	var initialLd, player, sliderUpdate;
  var sliderRE = /(\d+)(?:\.\d+)?/;

  function onPlayerStateChange( event ) {
    if ( event.data == YT.PlayerState.PLAYING ) {
      if ( initialLd ) {
        initialLd = false;
        $scope.slider.from = 0;
        $scope.slider.to = lesson.pbstop - lesson.pbstart;
        $scope.value = 0;
        $scope.$digest();
      }
      if ( !angular.isDefined( $scope.sliderUpdate ) ) {
        $scope.sliderUpdate = $interval( function () {
          $scope.value = player.getCurrentTime() - lesson.pbstart;
        }, 1000 );
      }
    } else if ( event.data == YT.PlayerState.PAUSED ) {
      if ( angular.isDefined( $scope.sliderUpdate ) ) {
        $interval.cancel( $scope.sliderUpdate );
        $scope.sliderUpdate = undefined;
      }
    }
  }
  $scope.lesson = lesson;
  lesson.actions = [ 0 ];
  $scope.submit = function () {
    lesson.submitted = true;
    LessonSvc.writeViewing( lesson ).then( function () {
      loc.path( '#/' );
    }
  ) };
  VideoSvc.createPlayer().then( function ( newPalyer ) {
    player = newPalyer;
    var patt = /(\x2Fv\x2F(.+)\x3Fversion=)|(\x2Fwatch\x3Fv=(.+))/;

    var m = lesson.video_id.match( patt );
    if ( m != null ) {
      video = m[ 2 ] || m[ 4 ];
    } else {
      video = videourl;
    }
    var videoReq = { videoId: video,  startSeconds: lesson.pbstart, endSeconds: lesson.pbstop };
    player.loadVideoById( videoReq );
    player.addEventListener( 'onStateChange', onPlayerStateChange );
    player.addEventListener( 'onError', function ( event ) {
      $scope.playerError = true;
//      showAlert( 'warning', i18n.literals.VIDEO_ERR );
      $scope.$digest();
    } );
    initialLd = true;
  } );
  $scope.value = 0;
	$scope.slider = {
		from: 0,
		to: 100,
		step: 1,
		dimension: " sec",
		realtime: true,
    skin: 'blue',
		callback: function ( value, released ) {
			if ( angular.isDefined( $scope.sliderUpdate ) ) {
				$interval.cancel( $scope.sliderUpdate );
				$scope.sliderUpdate = undefined;
			}
      var match = sliderRE.exec( value );
      player.seekTo( parseInt( match[ 1 ] ) + lesson.pbstart, released );
			if ( released ) {
        var action = Math.floor( player.getCurrentTime() - lesson.pbstart ) << 16 | parseInt( $scope.value );
        if ( lesson.actions[ lesson.actions.length - 1 ] != action ) {
          lesson.actions.push( action );
        }
				$scope.sliderUpdate = $interval( function () {
          $scope.value = player.getCurrentTime() - lesson.pbstart;
				}, 1000 );
			}
		}
	};
	$scope.$on( '$destroy', function () {
		if ( angular.isDefined( $scope.sliderUpdate ) ) {
			$interval.cancel( $scope.sliderUpdate );
			$scope.sliderUpdate = undefined;
		}
    if ( !lesson.submitted ) {
      lesson.submitted = false;
      LessonSvc.writeViewing( lesson );
    }
	} );
} ] );

students.service( 'TranslationService', function ( $http, $log ) {
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

students.service( 'VideoPlayerSvc', function ( $window, $q, $log ) {
  var deferred = $q.defer();
  var script = document.createElement('script');
  script.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(script, firstScriptTag);
  $window.onYouTubeIframeAPIReady = function () {
    deferred.resolve();
  };

  this.init = deferred.promise;
  this.createPlayer = function ( type ) {
    var that = this;
    var defer = $q.defer();
    var player = new YT.Player( 'player', {
      playerVars: { 'controls': 0 },
      events: {
        'onReady': function ( event ) {
          defer.resolve( player );
          that.player = player;
        }
      }
    } );

    return defer.promise;
  }
} );

students.service( 'LessonSvc', function ( $http, $location, $log ) {
  this.writeViewing = function ( lesson ) {
    var re = /\.*\/students\/(\d+)#/;
    var result = re.exec( $location.absUrl() );
    var studentID = result[ 1 ];
    var view = {
      student: studentID,
      submitted: lesson.submitted,
    };
    var answers = lesson.questions.map( function ( q ) {
      var answer = { question: q.id };
      answer[ 'answer' ] = q.type == 'multi' ? q.correct : q.answer;
      return answer;
    } );
    view.answers = answers.filter( function ( a ) {
      return typeof( a.answer ) !== 'undefined';
    } );
    view.answers = JSON.stringify( view.answers );
    view.actions = lesson.actions.join( ' ' );
    var uri = '/teachers/' + lesson.teacherID + '/lessons/' + lesson.lessonID + '/views/';
    return $http.post( uri, view ).then( function ( response ) {
      return response.data;
    } );
  };
} );
