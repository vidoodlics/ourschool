var lessons = angular.module( 'lessons', [ 'questions', 'students' ] );

lessons.controller( 'LessonCtrl', [ '$scope', '$interval', '$timeout', 'lesson', 'LessonSvc', 'VideoPlayerSvc', 'TranslationService', '$log', '$location',
                                   function ( $scope, $interval, $timeout, lesson, LessonSvc, VideoSvc, i18n, $log, loc ) {
	var initialLd, player, sliderUpdate, updateleft = true;
  var sliderRE = /(\d+)(?:\.\d+)?;(\d+)(?:\.\d+)?/;
  var sliderLeftRE = /\d+(\.\d+)?/;
  var sliderRgihtRE = /\d+(\.\d+)?$/;

  function onPlayerStateChange( event ) {
    if ( event.data == YT.PlayerState.PLAYING ) {
      if ( initialLd ) {
        videoDuration = player.getDuration();
        initialLd = false;
        lesson.pbstart = lesson.pbstart || 0;
        lesson.pbstop = lesson.pbstop || Math.floor( videoDuration );
        $scope.slider.from = 0;
        $scope.slider.to = videoDuration;
        $scope.value = lesson.pbstart + ';' + lesson.pbstop;
        $scope.$digest();
      }
      if ( !angular.isDefined( $scope.sliderUpdate ) ) {
        $scope.sliderUpdate = $interval( function () {
          var re = updateleft ? sliderLeftRE : sliderRgihtRE;
          $scope.value = $scope.value.replace( re, player.getCurrentTime() );
          $scope.backup = $scope.value;
        }, 1000 );
      }
    } else if ( event.data == YT.PlayerState.PAUSED ) {
      if ( angular.isDefined( $scope.sliderUpdate ) ) {
        $interval.cancel( $scope.sliderUpdate );
        $scope.sliderUpdate = undefined;
      }
    }
  }

  function watchUrlChange( newValue, oldValue ) {
		if ( newValue ) {
			var videourl = newValue;
			var patt = /(\x2Fv\x2F(.+)\x3Fversion=)|(\x2Fwatch\x3Fv=(.+))/;

			$scope.playerError = false;
      var m = videourl.match( patt );
			if ( m != null ) {
				video = m[ 2 ] || m[ 4 ];
			} else {
				video = videourl;
			}
			lesson.videoid = video;
      var videoReq = { videoId: video };
      if ( angular.isDefined( lesson.pbstart ) ) {
        videoReq.startSeconds = lesson.pbstart;
        videoReq.endSeconds = lesson.pbstop;
        $scope.value = lesson.pbstart + ";" + lesson.pbstop;
      }
			player.loadVideoById( videoReq );
			initialLd = true;
		}
  }

  function showAlert( type, msg ) {
    $scope.alertobj.type = type;
    $scope.alertobj.msg = msg;
    $scope.alert = true;
    $timeout( function () { $scope.alert = false; }, 3000 );
  }

	$scope.lesson = lesson;
  $scope.cancel = function () {
    loc.path( '/' );
  };
  $scope.submit = function () {
    LessonSvc.writeLesson( lesson ).then( function ( response ) {
      showAlert( 'success', i18n.literals.SUCCESS );
      if ( response != 'OK' ) {
        loc.path( '/lessons/' + lesson.id, false );
        $scope.lessons.push( lesson );
      } else {
        $scope.$emit( 'lessonUpdate', lesson );
      }
    } );
  };
  $scope.setPBStart = function () {
    var match = sliderRE.exec( $scope.value );
    lesson.pbstart = match[ 1 ];
  };
  $scope.setPBStop = function () {
    lesson.pbstop = Math.floor( player.getCurrentTime() );
    $scope.value = $scope.value.replace( /;\d+(\.\d+)?/, ';' + lesson.pbstop );
  };
  $scope.newOnCurrent = function () {
    LessonSvc.newLesson( lesson ).then( function ( l ) {
      lesson = l;
      $scope.lesson = lesson;
      $scope.value = lesson.pbstart + ";" + lesson.pbstop;
    }
  ) };
  $scope.alert = false;
  $scope.alertobj = {};
  VideoSvc.createPlayer().then( function ( newPalyer ) {
    player = newPalyer;
    player.addEventListener( 'onStateChange', onPlayerStateChange );
    player.addEventListener( 'onError', function ( event ) {
      $scope.playerError = true;
      showAlert( 'warning', i18n.literals.VIDEO_ERR );
      $scope.$digest();
    } );
    $scope.$watch( 'lesson.videourl', watchUrlChange );
  } );
  $scope.value = "0;100";
  $scope.backup = $scope.value;
	$scope.slider = {
		from: 0,
		to: 100,
		step: 1,
		dimension: " sec",
		realtime: false,
    skin: 'blue',
		callback: function ( value, released ) {
			if ( angular.isDefined( $scope.sliderUpdate ) ) {
				$interval.cancel( $scope.sliderUpdate );
				$scope.sliderUpdate = undefined;
			}
      var match = sliderRE.exec( value );
      player.seekTo( match[ 1 ], released );
			if ( released ) {
        var backup = sliderRE.exec( $scope.backup );
        var newvalue = sliderRE.exec( $scope.value );
        updateleft = Math.abs( parseInt( backup[ 1 ] ) - parseInt( newvalue[ 1 ] ) ) > 2;
        var pos = updateleft ? newvalue[ 1 ]  : newvalue[ 2 ];
        player.seekTo( pos, released );
				$scope.sliderUpdate = $interval( function () {
          var re = updateleft ? sliderLeftRE : sliderRgihtRE;
          $scope.value = $scope.value.replace( re, player.getCurrentTime() );
          $scope.backup = $scope.value;
				}, 1000 );
			}
		}
	};
	$scope.$on( '$destroy', function () {
		if ( angular.isDefined( $scope.sliderUpdate ) ) {
			$interval.cancel( $scope.sliderUpdate );
			$scope.sliderUpdate = undefined;
		}
	} );
  $scope.$on( 'lessonChange', function ( event, id ) {
    LessonSvc.getLesson( id ).then( function ( response ) {
      angular.copy( response, lesson );
      loc.path( '/lessons/' + id, false );
    } );
  } );
} ] );

lessons.controller('LessonStatistics', [ '$scope', '$interval', 'VideoPlayerSvc', 'lesson', 'statistics', '$window', function ( $scope, $interval, VideoSvc, lesson, stats, $window ) {
	var initialLd, player, sliderUpdate;
  var sliderRE = /(\d+)(?:\.\d+)?/;
  var margin = {top: 5, right: 0, bottom: 5, left: 0},
      height = 100 - margin.top - margin.bottom;
  var x = d3.scale.linear().domain( [ 0, stats.actions.length ] );
  var y = d3.scale.linear()
      .range([height, 0])
      .domain(d3.extent(stats.actions));
  var line = d3.svg.line()
      .x( function( d, i ) { return x( i ); } )
      .y( function( d ) { return y( d ); } );

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
  };

  function drawChart() {
    var width = parseInt(d3.select( '#chart' ).style( 'width' ) ) - margin.left - margin.right;

    x.range( [ 0, width ] );
    d3.select( "#chart svg" ).remove()
    var svg = d3.select( "#chart" ).append( "svg" )
        .attr( "width", width + margin.left + margin.right )
        .attr( "height", height + margin.top + margin.bottom )
        .on( "click", function ( d, i ) { player.seekTo( Math.round( x.invert( d3.mouse( this )[0] ) ) + lesson.pbstart, true ); } )
      .append( "g" )
        .attr( "transform", "translate(" + margin.left + "," + margin.top + ")" );

    svg.append( "path" )
       .datum( stats.actions )
       .attr( "class", "line" )
       .attr( "d", line );
  };

  $scope.lesson = lesson;
  $scope.stats = stats;
  lesson.questions.forEach( function ( q ) {
    if ( stats.multi.hasOwnProperty( q.id ) ) {
      q.stats = stats.multi[ q.id ];
    }
  } );
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
				$scope.sliderUpdate = $interval( function () {
          $scope.value = player.getCurrentTime() - lesson.pbstart;
				}, 1000 );
			}
		}
	};
  drawChart();
  angular.element( $window ).bind( 'resize', function () {
    drawChart();
  } );
	$scope.$on( '$destroy', function () {
		if ( angular.isDefined( $scope.sliderUpdate ) ) {
			$interval.cancel( $scope.sliderUpdate );
			$scope.sliderUpdate = undefined;
		}
	} );
} ] );

lessons.controller( 'StudentsStatistics', [ '$scope', function ( $scope ) {

} ] );

lessons.controller( 'StudentStatistics', [ '$scope', '$interval', 'VideoPlayerSvc', 'lesson', 'statistics', '$window', function ( $scope, $interval, VideoSvc, lesson, actions, $window ) {
	var initialLd, player, sliderUpdate;
  var sliderRE = /(\d+)(?:\.\d+)?/;
  var margin = {top: 5, right: 0, bottom: 5, left: 0},
      height = 100 - margin.top - margin.bottom;
  var x = d3.scale.linear().domain( [ 0, actions.length ] );
  var y = d3.scale.linear()
      .range([height, 0])
      .domain(d3.extent(actions));
  var line = d3.svg.line()
      .x( function( d, i ) { return x( i ); } )
      .y( function( d ) { return y( d ); } );

  function drawChart() {
    var width = parseInt(d3.select( '#chart' ).style( 'width' ) ) - margin.left - margin.right;

    x.range( [ 0, width ] );
    d3.select( "#chart svg" ).remove()
    var svg = d3.select( "#chart" ).append( "svg" )
        .attr( "width", width + margin.left + margin.right )
        .attr( "height", height + margin.top + margin.bottom )
        .on( "click", function ( d, i ) { player.seekTo( Math.round( x.invert( d3.mouse( this )[0] ) ) + lesson.pbstart, true ); } )
      .append( "g" )
        .attr( "transform", "translate(" + margin.left + "," + margin.top + ")" );

    svg.append( "path" )
       .datum( actions )
       .attr( "class", "line" )
       .attr( "d", line );
  };

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
  };

  $scope.lesson = lesson;
  $scope.actions = actions;
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
				$scope.sliderUpdate = $interval( function () {
          $scope.value = player.getCurrentTime() - lesson.pbstart;
				}, 1000 );
			}
		}
	};
  drawChart();
  angular.element( $window ).bind( 'resize', function () {
    drawChart();
  } );
	$scope.$on( '$destroy', function () {
		if ( angular.isDefined( $scope.sliderUpdate ) ) {
			$interval.cancel( $scope.sliderUpdate );
			$scope.sliderUpdate = undefined;
		}
	} );
} ] );

lessons.service( 'VideoPlayerSvc', function ( $window, $q, $log ) {
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

lessons.service( 'LessonSvc', function ( $http, TranslationService, VideoPlayerSvc, $location, $log ) {
  this.newLesson = function ( base ) {
    return TranslationService.init.then( function () {
      var lesson = {
        descr: TranslationService.literals.NEW,
        uri: '/teachers/' + teacher_id + '/lessons/',
        questions: [],
        students: []
      };
      if ( base ) {
        lesson.videoid = base.videoid;
        lesson.videourl = base.videourl;
        var pbstop = Math.floor( VideoPlayerSvc.player.getDuration() );
        if ( base.pbstop == pbstop ) {
          lesson.pbstart = base.pbstart;
          lesson.pbstop = base.pbstop;
        } else {
          lesson.pbstart = base.pbstop;
          lesson.pbstop = pbstop;
          VideoPlayerSvc.player.seekTo( lesson.pbstart );
        }
      }
      return lesson;
      } );
  };
  this.writeLesson = function ( lesson ) {
    var reqdata = angular.copy( lesson );
    reqdata.questions = JSON.stringify( reqdata.questions );
    reqdata.students = JSON.stringify( reqdata.students.map( function ( elem ) { return elem.id; } ) );
    if ( reqdata.id ) {
      return $http.put( reqdata.uri, reqdata ).then( function ( response ) {
        response.data.questions.forEach( function ( q, idx ) {
          lesson.questions[ idx ].id = q;
        } );
        return 'OK';
      } );
    } else {
      return $http.post( reqdata.uri, reqdata ).then( function ( response ) {
        lesson.uri += response.data.id;
        lesson.id = response.data.id;
        response.data.questions.forEach( function ( q, idx ) {
          lesson.questions[ idx ].id = q;
        } );
        return response;
      } );
    }
  };
  this.getLesson = function ( lessonId ) {
    if ( lessonId ) {
      var uri = '/teachers/' + teacher_id + '/lessons/' + lessonId;
      return $http.get( uri ).then( function ( response ) {
        var lesson = response.data;
        lesson.id = lessonId;
        lesson.uri = uri;
        lesson.videourl = lesson.video_id;
        return response.data;
      } );
    }
  };
  this.delLesson = function ( lessonId ) {
    var uri = '/teachers/' + teacher_id + '/lessons/' + lessonId;
    return $http.delete( uri ).then( function ( response ) {
      return response.data;
    } );
  };
} );

var album = angular.module( 'album', [] );

/*album.controller( 'AlbumCtrl', [ '$log', function ( $log ) {
  this.title = 'Hello';
  $log.info( 'Hello' );
} ] );*/
album.controller( 'AlbumCtrl', [ '$log', AlbumCtrl ] );

function AlbumCtrl( $log ) {
  this.title = 'Hello';
  this.greet( $log );
}

AlbumCtrl.prototype.greet = function ( $log ) {
  $log.info( 'Hello' );
}
