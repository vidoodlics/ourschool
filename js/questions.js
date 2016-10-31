var questions = angular.module( 'questions', [] );

questions.controller( 'QuestionsCtrl', [ '$scope', '$modal', 'VideoPlayerSvc', 'QuestionSvc', function ( $scope, $modal, VideoPlayerSvc, QuestionSvc ) {
  $scope.newQuestion = function () {
    var modalInstance = $modal.open( {
      templateUrl: '/views/partials/question.html',
      controller: 'QuestionDialogCtrl',
      resolve: {
        question: function () {
          return QuestionSvc.newQuestion();
        },
        title: function ( ) {
          return 'NEW_QUESTION';
        }
      }
    } );

    modalInstance.result.then( function ( question ) {
/*      question.id = ++$scope.lesson.questionLastIdx;
      if ( $scope.lesson.id ) {
        QuestionSvc.writeQuestion( $scope.lesson.id, question ).then( function () {
          $scope.lesson.questions.push( question );
        } );
      } else {*/
        $scope.lesson.questions.push( question );
//      }
    } );
  };
  $scope.editQuestion = function ( q ) {
    var question = angular.copy ( q );
    question.answers = question.answers.map( function ( elem ) {
      return { text: elem };
    } );
    var modalInstance = $modal.open( {
      templateUrl: '/views/partials/question.html',
      controller: 'QuestionDialogCtrl',
      resolve: {
        'question': function () {
          return question;
        },
        title: function ( ) {
          return 'EDIT_QUESTION';
        }
      }
    } );

    modalInstance.result.then( function ( question ) {
      angular.copy( question, q );
    } );
  };
  $scope.removeQuestion = function ( question, index ) {
    var modalInstance = $modal.open( {
      templateUrl: 'confirmation.html',
      controller: 'ConfirmationCtrl',
      resolve: {
        'question': function () {
          return question;
        }
      }
    } );
    modalInstance.result.then( function () {
      $scope.lesson.questions.splice( index, 1 );
    } );
  };
} ] );

questions.controller( 'ConfirmationCtrl', [ '$scope', '$modalInstance', 'question', 'TranslationService', function ( $scope, $modalInstance, question, i18n ) {
  $scope.i18n = i18n;
  $scope.question = question;
  $scope.ok = function () {
    $modalInstance.close();
  };
  $scope.cancel = function () {
    $modalInstance.dismiss();
  };
} ] );

questions.controller( 'QuestionDialogCtrl', [ '$scope', '$modalInstance', 'question', 'title', 'TranslationService', 'VideoPlayerSvc', '$log',
                                             function ( $scope, $modalInstance, question, title, i18n, PlayerSvc, $log ) {
  function formValidation( results ) {
    var valid = true;

    if ( $scope.form.qtext.$error.required ) {
      results.errors++;
    }
    if ( question.type == 'single' && $scope.form.atext.$error.required ) {
      results.warnings++;
    }
    if ( question.type == 'multi' ) {
      for ( fld in $scope.form ) {
        if ( fld.substring( 0, 4 ) == 'text' ) {
          if ( $scope.form[ fld ].$error.required ) {
            results.warnings++;
            break;
          }
        }
      }
      if ( !question.correct ) {
        results.warnings++;
      }
      if ( question.answers.length == 1 ) {
        results.warnings++;
      }
    }
  }

  var validationResults = {
    errors: 0,
    warnings: 0,
    pass: 0
  };
  $scope.alerts = [];
  $scope.i18n = i18n;
  $scope.title = i18n.literals[title];
  $scope.question = question;
  $scope.ok = function () {
    validationResults.errors = validationResults.warnings = 0;
    validationResults.pass++;
    formValidation( validationResults );
    if ( !validationResults.errors ) {
      if ( !validationResults.warnings || validationResults.pass > 1 ) {
        question.answers = question.answers.map( function ( elem ) {
          return elem.text;
        } );
        $scope.question.dirty = validationResults.warnings;
        $modalInstance.close( question );
      }
    }
  };
  $scope.cancel = function () {
    $modalInstance.dismiss();
  };
  $scope.addAnswer = function () {
    question.answers.push( {} );
  };
  $scope.removeAnswers = function () {
    question.answers.forEach( function ( cur, idx, arr ) {
      if ( cur.checked ) {
        arr.splice( idx, 1 );
        if ( question.correct && question.correct  > idx ) {
          question.correct--;
        }
      }
    } );
  };
  $scope.linkTo = function () {
    question.link = question.link ? false : Math.floor( PlayerSvc.player.getCurrentTime() );
  };
} ] );
questions.service( 'QuestionSvc', function ( $http ) {
  this.newQuestion = function () {
    return { type: 'multi', answers: [] };
  };
  this.writeQuestion = function ( lessonID, question ) {
    var uri = '/teachers/' + teacher_id + '/lessons/' + lessonID + '/questions/' + question.id;
    var reqdata = angular.copy( question );
    reqdata.answers = JSON.stringify( reqdata.answers );
    return $http.put( uri, reqdata ).then( function ( response ) {
      return response.data;
    } );
  };
} );
