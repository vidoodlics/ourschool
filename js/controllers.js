var controllers = angular.module( 'controllers', [] );

controllers.config( [ '$httpProvider', function ( $httpProvider ) { 
	// Use x-www-form-urlencoded Content-Type
	$httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
 
	/**
	 * The workhorse; converts an object to x-www-form-urlencoded serialization.
	 * @param {Object} obj
	 * @return {String}
	 */
	var param = function(obj) {
		var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

	for(name in obj) {
		value = obj[name];
  
		if(value instanceof Array) {
			for( i=0; i<value.length; ++i ) {
				subValue = value[ i ];
				fullSubName = name + '[' + i + ']';
				innerObj = {};
				innerObj[ fullSubName ] = subValue;
				query += param( innerObj ) + '&';
			}
		} else if( value instanceof Object ) {
			for(subName in value) {
				subValue = value[subName];
				fullSubName = name + '[' + subName + ']';
				innerObj = {};
				innerObj[fullSubName] = subValue;
				query += param(innerObj) + '&';
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
} ] );

controllers.controller( 'LessonCtrl', [ '$scope', '$interval', 'lesson', '$log', function ( $scope, $interval, lesson, $log ) {
	var initialLd, player, sliderUpdate;
	
	$scope.lesson = lesson;
	$scope.slider = {
		floor: 0,
		ceiling: 50	
	};
	player = new YT.Player('player', {
		playerVars: { 'controls': 0 },
		events: {
			'onReady': function ( event ) { $scope.videoLoaded = true; $scope.slider.ceiling = 100; },
			'onStateChange': function ( event ) {
				if ( event.data == YT.PlayerState.PLAYING ) {
					if ( initialLd ) {
						videoDuration = player.getDuration();
						initialLd = false;
//						$( '#slider-wrap' )
//							.find( '*' )
//								.remove()
//							.end()
//							.append( '<input type="text" id="slider">' );
//						$slider = $( '#slider' );
//						$slider.simpleSlider( { theme: 'volume', highlight: true, range: [ 0, videoDuration ] } );
						lesson.pbstart = 0;
						lesson.pbstop = Math.floor( videoDuration );
						$scope.$digest();
//						$( "#pbrange input[name=pbstart]" ).val( 0 );
//						$( "#pbrange input[name=pbstop]" ).val( Math.floor( videoDuration ) );
					}
					if ( !angular.isDefined( $scope.sliderUpdate ) ) {
						$scope.sliderUpdate = $interval( function () {
							$scope.value = player.getCurrentTime();
//							$log.info( $scope.value );
						}, 2000 );
					}
				} else if ( event.data == YT.PlayerState.PAUSED ) {
					if ( angular.isDefined( $scope.sliderUpdate ) ) {
						$interval.cancel( $scope.sliderUpdate );
						$scope.sliderUpdate = undefined;
					}
				}				
			},
			'onError': onPlayerError
		}
	});
	$scope.$watch( 'videourl', function ( newValue, oldValue ) {
		if ( newValue ) {
			var videourl = newValue;
			var patt = /(\x2Fv\x2F(.+)\x3Fversion=)|(\x2Fwatch\x3Fv=(.+))/;
			
			var m = videourl.match( patt );
			if ( m != null ) {
				video = m[ 2 ] || m[ 4 ];
			} else {
				video = videourl;
			}
			lesson.videoid = video;
//			$( this ).parent().removeClass( 'has-error' );
			player.loadVideoById( { videoId: video } );
			initialLd = true;
		}
	} );
	$scope.$on( '$destroy', function () { 
		if ( angular.isDefined( $scope.sliderUpdate ) ) {
			$interval.cancel( $scope.sliderUpdate );
			$scope.sliderUpdate = undefined;
		}
	} );
	$scope.value = "1";
	$scope.slider = {       
		from: 1,
		to: 100,
		step: 1,
		dimension: " km",
		css: {
			background: {"background-color": "silver"},
			before: {"background-color": "purple"},
			default: {"background-color": "white"},
			after: {"background-color": "green"},
			pointer: {"background-color": "red"}          
		},
		realtime: true,
		callback: function ( value, released ) {
			if ( angular.isDefined( $scope.sliderUpdate ) ) {
				$interval.cancel( $scope.sliderUpdate );
				$scope.sliderUpdate = undefined;
			}
			player.seekTo( value, released );
//			$scope.value = value;
			if ( released ) {
				$scope.sliderUpdate = $interval( function () {
					$scope.value = player.getCurrentTime();
//					$log.info( $scope.value );
				}, 2000 );
			}
		}
	};
} ] );