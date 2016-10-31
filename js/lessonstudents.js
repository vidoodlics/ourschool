var students = angular.module( 'students', [] );

students.controller( 'StudentsCtrl', [ '$scope', '$uibModal', 'StudentSvc', function ( $scope, $modal, StudentSvc ) {
  $scope.addStudent = function () {
    var modalInstance = $modal.open( {
      templateUrl: '/views/partials/lessonstudents.html',
      controller: 'StudentsDialogCtrl',
      size: 'md',
      resolve: {
        students: function () {
          return StudentSvc.getStudents();
        },
        lesson: function () {
          return $scope.lesson;
        }
      }
    } );
  };
  $scope.removeStudent = function ( index ) {
    $scope.lesson.students.splice( index, 1 );
  };
} ] );

students.controller( 'StudentsDialogCtrl', [ '$scope', '$uibModalInstance', 'TranslationService', 'students', 'lesson', '$log', function ( $scope, $modalInstance, i18n, students, lesson, $log ) {
  $scope.i18n = i18n;
  $scope.students = students.filter( function ( elem ) {
    if ( !lesson.students.some( function ( elm ) { return elm.id == elem.id; } ) ) {
      return true;
    }
  } );
  $scope.cancel = function () {
    $modalInstance.dismiss();
  };
  $scope.ok = function () {
    $scope.students.forEach( function ( student ) {
      if ( student.selected ) {
        lesson.students.push( student );
      }
    } );
    $modalInstance.close();
  };
/*  function formValidation( results ) {
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
  };*/
} ] );

students.service( 'StudentSvc', function ( $http ) {
  this.getStudents = function () {
    return $http.get( '/students' ).then( function ( response ) {
      return response.data;
    } );
  };
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
