var lessonsSideTemplate, lessonsNavTemplate, lessonItemTemplate;
var lessonsSideItemTemplate, multiAnswerTemplate, questionTemplate;
var questionDialogTemplate, confirmDialogTemplate
var video;
var questions = [];
var qIdx;
var initialLd, videoDuration, step = 30;
var sliderUpdateID, fromUpdate;
var $question = $( "#question" );
var $dashboardLink = $( ".nav-sidebar a[href=dashboard]" );
var $slider;
var SEEK_START = '0';
var SEEK_CUR = 'curpos';
var SEEK_END = 'duration';

var handlers = {
	'confAccept': null,
	'lessonSubmit': null,
	'saveQuestion': null,
	'dashboard': dashboardHandler,
	'lessonNew': newLessonHandler,
	'lessonEdit': lessonEditHandler,
	'lessonRemove': lessonRemoveHandler,
	'questionNew': newQuestionHandler,
	'questionEdit': editQuestionHandler,
	'questionRemove': removeQuestionHandler,
	'questionLink': function() {
		var idx = $( this ).closest( 'tr' ).find( 'td:first-child' ).text() - 1
		player.seekTo( questions[ idx ][ 'link' ] );		
	 },
	 'setPBStart': function() { 	$( "#pbrange input[name=pbstart]" ).val( Math.round( player.getCurrentTime() ) ); },
	 'setPBStop': setPBStop,
};

function testHandler() {
	alert( 'Hi' );
}

function dashboardHandler() {
	player.stopVideo();
	switchMain.call( this, 'dashboard' );
}

function newLessonHandler() {
	questions = [];
	var newlesson = {
		descr: 'New',
	};
	handlers[ 'lessonSubmit' ] = lessonNewAction;
	lessonDetails( newlesson );
	switchMain.call( this, 'lesson' );
}

function lessonEditHandler() {
	var url = $( this ).parent().attr( 'href' );
	var elem = $( this ).parent();
	handlers[ 'lessonSubmit' ] = ( function( $item ) {
		return function() {
			var form = $( "#lesson form" ).serializeArray();
			var l = {};
			for ( var i = 0; i < form.length; i++ ) {
				l[ form[i].name ] = form[ i ].value;
			}
			l[ 'questions' ] = JSON.stringify( questions );
			var lessonURL = $item.attr( 'href' );
			var lessonRequestObj = {
				type: 'PUT',
				url: lessonURL,
				data: l,
				success: function( resp ) {
					$( "#lessons-nav a[href='" + lessonURL + "']" ).text( l.descr );
					var prevDescr = $item.text().trim();
					$item.replaceText( prevDescr, l.descr );
					alert( resp );
					switchMain.call( $dashboardLink, 'dashboard' )
				}
			};
			$.ajax( lessonRequestObj );	
		}
	} ( elem ) );
	$.get( url, function( lesson ) {
		lessonDetails( lesson );
		switchMain.call( elem, 'lesson' );
	}, 'json' );
}

function lessonStatsHandler() {
	alert( 'Stat' );
}

function lessonRemoveHandler() {
	handlers[ 'confAccept' ] = ( function( $item ) {
		return function() {
			var lessonURL = $( 'a', $item ).attr( 'href' );
			var lessonRequestObj = {
				type: 'DELETE',
				url: lessonURL,
				success: function( resp ) {
					var no_lessons = $item.parent().find( 'li' ).length;
					if ( no_lessons == 1 ) {
						$( '#lessons-side' ).remove();
						$( '#lessons-nav' ).remove();
					} else { 
						$( "#lessons-nav a[href='" + lessonURL + "']" ).parent().remove();
						$item.remove();
					}
					$( '#confirm' ).modal( 'hide' );
				}
			};
			$.ajax( lessonRequestObj );
			switchMain.call( $dashboardLink, 'dashboard' );
		}
	} ($( this ).closest( 'li' ) ) );
	$( "#confirm .modal-dialog" ).html( confirmDialogTemplate( {} ) );
	$( "#confirm" ).modal( 'show' );
}

function switchMain( newmain ) {
	$( ".main:visible" ).hide();
	$( "#" + newmain ).show();
	$( ".nav-sidebar .active" ).removeClass( 'active' );
	$( this ).parent().addClass( 'active' );
}

function lessonDetails( lesson ) {
	var $lesson = $( '#lesson' );
	$( '#lesson-descr' ).text( lesson.descr );
	$( 'tbody', $lesson).empty();
	if ( 'undefined' == typeof lesson.video_id ) {
		$( 'input[name=videoid], input[name=descr], input[name=videourl], input[name=pbstart], input[name=pbstop]', $lesson ).val( '' );
	} else {
		questions = lesson.questions;
		player.loadVideoById( lesson.video_id );
		initialLd = true;
		$( 'input[name=videoid]', $lesson ).val( lesson.video_id );
		$( 'input[name=videourl]', $lesson).val( lesson.video_id );
		$( 'input[name=descr]', $lesson ).val( lesson.descr );
		for ( var i = 0; i < lesson.questions.length; i++ ) {
			$( "tbody", $lesson ).append( questionTemplate( { no: i + 1, question: lesson.questions[ i ] } ) );
		}
	}
/*	if ( lesson.flags & SLIDE ) {
		$( 'input[name=vctrl][value=sld]', $lesson ).prop( 'checked', true ).parent().addClass( 'active' );
		$( 'input[name=vctrl][value=btn]', $lesson ).prop( 'checked', false ).parent().removeClass( 'active' );
		$( '#slider-wrap', $lesson).removeClass( 'hidden' );
		$( '#button-ctrl', $lesson).addClass( 'hidden' );
	} else {
		$( 'input[name=vctrl][value=sld]', $lesson ).prop( 'checked', false ).parent().removeClass( 'active' );
		$( 'input[name=vctrl][value=btn]', $lesson ).prop( 'checked', true ).parent().addClass( 'active' );
		$( '#slider-wrap', $lesson).addClass( 'hidden' );
		$( '#button-ctrl', $lesson).removeClass( 'hidden' );
	}*/
}

function newQuestionHandler() {
	var n = { info: { 'action': 'Add',
							 'MULTI': MULTI,
							 'SINGLE': SINGLE
						 }, 
				 'qtype': MULTI, 
				 'correct': 1, 
				 'answers': [ '', '' ] };
	handlers[ 'saveQuestion' ] = newQuestion;
	$( ".modal-dialog", $question ).html( questionDialogTemplate( n ) );
}

function editQuestionHandler() {
	var $item = $( this ).closest( 'tr' );
	var idx = $item.find( 'td:first-child' ).text() - 1
	var question = questions[ idx ];
	question[ 'info' ] = { 'action': 'Edit', 'MULTI': MULTI, 'SINGLE': SINGLE };
	handlers[ 'saveQuestion' ] = ( function( $item, idx ) {
		return function() {
			var q = createQuestion();
			questions[ idx ] = q;
			$question.modal( 'hide' );
			$item.replaceWith( questionTemplate( { no: idx + 1, question: q } ) );	
		}
	} ( $item, idx ) );
	$( ".modal-dialog", $question ).html( questionDialogTemplate( question ) );
	$question.modal( 'show' );
}

function removeQuestionHandler( idx ) {
	var $item = $( this ).closest( 'tr' );
	var idx = $item.find( 'td:first-child' ).text() - 1;
	handlers[ 'confAccept' ] = ( function( $item, idx ) {
		return function() {
			$( "#lesson tbody tr:gt(" + idx + ")" ).each( function( i ) {
				$( "td:first-child", this ).text( idx + i + 1 );
			} );
			$item.remove();
			questions.splice( idx, 1 );
			$( '#confirm' ).modal( 'hide' );
		}
	} ( $item, idx ) );
	$( "#confirm .modal-dialog" ).html( confirmDialogTemplate( {} ) );
	$( "#confirm" ).modal( 'show' );
}

function lessonNewAction() {
	var form = $( "#lesson form" ).serializeArray();
	var l = {};
	for ( var i = 0; i < form.length; i++ ) {
		l[ form[i].name ] = form[ i ].value;
	}
	l[ 'questions' ] = JSON.stringify( questions );
	$.post( '/teachers/' + teacher_id + '/lessons', l, function ( resp ) {
		if ( resp != '0' ) {
			var $lessons = $( "#lessons-side" );
			var con = {
				descr: $( "#lesson form input[name=descr]").val(),
				id: resp,
				'teacher_id': teacher_id
			};
			if ($lessons.length == 0) {
				$( ".navbar-nav li:eq(1)" ).after( lessonsNavTemplate( con ) );
				$( ".nav-sidebar:eq(0)" ).after( lessonsSideTemplate( con ) );
			} else {
				$lessons.append( lessonSideItemTemplate( con ) );
				$( "#lessons-nav ul" ).append( lessonItemTemplate( con ) );
			}				
		} else {
			alert( 'ERROR writing lesson data' );
		}
	}, 'text' );
	switchMain.call( $dashboardLink, 'dashboard' );
}

function newQuestion() {
	var q = createQuestion();
	questions.push( q );
	$question.modal( 'hide' );
	$( "#lesson tbody" ).append( questionTemplate( { no: questions.length, question: q } ) );
}
	
function createQuestion() {
	var q = { answers: [] };
	q[ 'qtext' ] = $( '#qtext', $question ).val();
	q[ 'qtype' ] = Number( $( 'input[name=qtype]:checked', $question ).val() );
	var $qlink = $( 'input[name=link]', $question );
	if ( $qlink.prop( 'checked' ) ) {
		q[ 'link' ] = $qlink.val();
	}
	if ( q.qtype == 2 ) {
		q[ 'correct' ] = Number( $( 'input[name=correct]:checked', $question ).val() );
		$( '#multi input[name^=answer]', $question ).each( function( answer ) {
			q.answers.push( $( this ).val() );
		} );
	} else {
		q.answers.push( $( 'textarea[name=answer]', $question ).val() );
	}
	
	return q;
}

function seek(dist, origin)
{
	var curpos = Math.round(player.getCurrentTime()); // Collects the current second for the database
	var duration = videoDuration - 2; // Gets video's duration
	var newpos;
	
	player.unMute();
	newpos = eval(origin);
	newpos += dist;
	if (newpos < 0) {
		newpos = 0;
	} else if (newpos > duration) {
		newpos = duration;
	}
	player.seekTo(newpos, true);
}

function sliderUpdate() {
	fromUpdate = true;
	$slider.simpleSlider( 'setValue', player.getCurrentTime() );
}

function sliderTest( e, data ) {
	console.log( data.value );
}

function setPBStop() {
	var start = parseInt( $( "#pbrange input[name=pbstart]" ).val() );
	var stp = Math.round( player.getCurrentTime() );
	var $stp = $( "#pbrange input[name=pbstop]" );
	$stp.val( stp );
	$stp.parent().removeClass( 'has-error has-warning' )
	if ( stp <= start ) {
		$stp.parent().addClass( 'has-error' );
	} else if ( stp - start < 300 ) {
		$stp.parent().addClass( 'has-warning' );
	}
}

$( function() {
	$( "div.sidebar" ).delegate( 'a,span', 'click', function(e) {
		e.preventDefault();
		e.stopPropagation();
		var action = e.target.getAttribute( 'data-ourschool-action' );
		handlers[ action ].call( this );
	} );
	$( ".navbar-right" ).delegate( 'a.nav-sel', 'click', function(e) {
		e.preventDefault();
		var ref = $( this ).attr( 'href' );
		$( "div.sidebar a[href='" + ref + "']" ).click();
	} );
	$( "#lesson-submit" ).click( function() { handlers[ 'lessonSubmit' ]() } );
	$( "#cancel" ).click( function() { 
		player.stopVideo();		
		switchMain.call( $dashboardLink, 'dashboard' );
	} );
	$( "#pbrange button" ).click( function( e ) { 
		var action = e.target.getAttribute( 'data-ourschool-action' );
		handlers[ action ].call( this );
	} );
	$question.delegate( '#add-multi', 'click', function() {
		var no_answers = $( "#question input[name^=answer]" ).length;
		
		$( "#multi" ).append( multiAnswerTemplate( { no: no_answers + 1 } ) );
		$( "#remove-multi" ).prop( "disabled", false );
	} );
	$question.delegate( '#remove-multi', 'click', function() {
		$( "#multi input[name=check]:checked" ).closest( ".input-group" ).remove();
		var no_answers = $( "#question input[name^=answer]" ).length;
		if ( no_answers == 2 ) {
			$( this ).prop( "disabled", true );
		} else {
			$( "#multi .input-group:gt(1)" ).each( function( idx ) {
				$( "input[name^=answer]", this ).attr( 'name', 'answer' + ( 3 + idx ) );
				$( "input[name=correct]", this ).attr( 'value', 3 + idx );
			} );
		}
		if ( $( "#multi input[name=correct]:checked" ).length == 0 ) {
			$( "#multi input[name=correct]:first" ).prop( "checked", true );
		}
	} );
	$question.delegate( '#save-q', 'click', function() {	handlers[ 'saveQuestion' ]();	} );
	$( "#add-question" ).click( function() { handlers[ 'questionNew' ](); } );
	$( "#confirm" ).delegate( "#conf-accept", 'click', function() { handlers[ 'confAccept' ](); } );
	$( "#lesson table" ).delegate( 'span', 'click', function( e ) {
		var action = $( this ).attr( 'data-ourschool-action' );
		if ( action ) {
			handlers[ action ].call( this );
		}
	} );
	$( "#lesson form input[name=videourl]" ).change( function () {
		var videourl = $( this ).val();
		var patt = /(\x2Fv\x2F(.+)\x3Fversion=)|(\x2Fwatch\x3Fv=(.+))/;
		
		var m = videourl.match( patt );
		if ( m != null ) {
			video = m[ 2 ] || m[ 4 ];
		} else {
			video = videourl;
		}
		$( "#lesson input[name=videoid]" ).val( video );
		$( this ).parent().removeClass( 'has-error' );
		player.loadVideoById( { videoId: video } );
		initialLd = true;
	} );
	$( "#lesson input[name=vctrl]" ).change( function() {
		var val = $( this ).val();
		if ( val == 'sld' ) {
			$( "#lesson input[name=jump]" ).prop( "disabled", true );
		} else {
			$( "#lesson input[name=jump]" ).prop( "disabled", false );
		}
		$( '#slider-wrap').toggleClass( 'hidden' );
		$( '#button-ctrl').toggleClass( 'hidden' );
	} );

	$question.delegate( 'input[name=qtype]', 'change', function() {
		var val = $( this ).val();
		
		$( "#multi" ).toggleClass( 'hidden' );
		$( "#single" ).toggleClass( 'hidden' )
	} );
	$question.delegate( 'input[name=link]', 'change', function() {
		$( this ).val( player.getCurrentTime() );
	} );
	$( '#button-ctrl button' ).click( function() {
		var action = $( this ).attr( 'data-ourschool-action' );
		handlers[ action ].call( this );
	} );
	$( '#slider-wrap' ).delegate( '#slider', 'slider:changed', function (e, data ) { 
		if (!fromUpdate) {
			seek( data.value, SEEK_START );
		}
		fromUpdate = false;
	} );
	$( "#lesson input[name=jump]" ).prop( "disabled", false );

	Handlebars.registerHelper('multi', function( options ) {
		if ( this.qtype == MULTI ) {
			return options.fn( this );
		} else {
			return options.inverse( this );
		} 
	});

	Handlebars.registerHelper('single', function( options ) {
		if ( this.qtype == SINGLE ) {
			return options.fn( this );
		} else {
			return options.inverse( this );
		} 
	});

	Handlebars.registerHelper('over', function( options ) {
		if ( this.no > 2 ) {
			return options.fn( this );
		}		
	} );
	
	Handlebars.registerHelper('multi_answers', function( answers, options ) {
		var ret = '';
		for ( var i = 0; i < answers.length; i++ ) {
			var no = i + 1;
			var con = { 'no': no, answer: answers[ i ] };
			if ( no == this.correct ) {
				con[ 'correct' ] = no;
			}
			ret = ret + options.fn( con );
		}
		
		return ret;
	} );
	
	lessonsSideTemplate = Handlebars.compile( '<ul id="lessons-side" class="nav nav-sidebar">{{> sideitem}}</ul>' );
	lessonsNavTemplate = Handlebars.compile( $( "#lessons-nav-template" ).html() );
	lessonItemTemplate = Handlebars.compile( '<li><a href="/teachers/{{teacher_id}}/lessons/{{id}}" class="nav-sel">{{descr}}</a></li>' );
	lessonSideItemTemplate = Handlebars.compile( $( "#lessons-side-item-template" ).html() );
	multiAnswerTemplate = Handlebars.compile( $( "#multi-answer-template" ).html() );
	questionTemplate = Handlebars.compile( $( "#question-template" ).html() );
	questionDialogTemplate = Handlebars.compile( $( "#question-dialog-template" ).html() );
	confirmDialogTemplate = Handlebars.compile( $( "#confirmation-dialog-template" ).html() );

	Handlebars.registerPartial( 'answer', multiAnswerTemplate );
	Handlebars.registerPartial( 'sideitem', lessonSideItemTemplate );
	lessons = $( "#lessons-side" );
	$( "#slider" ).simpleSlider( { theme: 'volume', highlight: true });
} );