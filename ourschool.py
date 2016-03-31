import os
import urllib
import urllib2
import json

from urlparse import urlparse
from urlparse import urlunparse
from operator import attrgetter

from google.appengine.api import users
from google.appengine.ext import ndb

import jinja2
import webapp2

import model

Teacher = model.Teacher
Lesson = model.Lesson
Student = model.Student
Question = model.Question
View = model.View
school_key = model.school_key

def sampleData():
  teachers = Teacher.query(ancestor=school_key).count(limit=1)
  if teachers == 0:
    teacher = Teacher(parent=school_key)
    teacher.email = 'ssagiadin@gmail.com'
    teacher.first = 'Spyros'
    teacher.last = 'Sagiadinos'
    teacher.put()
    teacher = Teacher(parent=school_key)
    teacher.email = 'konstantinos@gmail.com'
    teacher.first = 'Konstantinos'
    teacher.last = 'Chorianopoulos'
    teacher.put()
  students = Student.query(ancestor=school_key).count(limit=1)
  if students == 0:
    student = Student(parent=school_key)
    student.email = 'ssagiadin@hotmail.com'
    student.first = 'Spyridon'
    student.last = 'Sagiadinos'
    student.put()
    student = Student(parent=school_key)
    student.email = 'choko@ionio.gr'
    student.first = 'Konstantinos'
    student.last = 'Chorianopoulos'
    student.put()

def newdata(request, *args, **kwargs):
  student = Student(parent=school_key)
  student.email = 'choko@ionio.gr'
  student.first = 'Konstantinos'
  student.last = 'Chorianopoulos'
  student.put()
  return webapp2.Response('OK')

SINGLE = 1
MULTI = 2
JINJA_ENVIRONMENT = jinja2.Environment(
  loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
  extensions=['jinja2.ext.autoescape'],
  autoescape=False,
  variable_start_string='{!',
  variable_end_string='!}',
  trim_blocks=True)
sampleData()

class MainPage(webapp2.RequestHandler):

  def get(self):
    template = JINJA_ENVIRONMENT.get_template('views/index.html')
    self.response.write(template.render())

class FB(webapp2.RequestHandler):

  def FBLogin(self):
    self.redirect('https://www.facebook.com/dialog/oauth?client_id=1696184257279848&redirect_uri=' + self.request.host_url + '/fbresponse&scope=email')

  def FBResponse(self):
    code = self.request.get('code')
    data = { 'client_id': '1696184257279848' }
    data['redirect_uri'] = self.request.host_url + '/fbresponse'
    data['client_secret'] = '6e588b32abc3782e24b23821dbe22bf2'
    data['code'] = code
    url_values = urllib.urlencode(data)
    data = json.load(urllib2.urlopen('https://graph.facebook.com/v2.3/oauth/access_token?' + url_values))
    access_token = data['access_token']
    data = json.load(urllib2.urlopen('https://graph.facebook.com/v2.4/me?fields=email&access_token=' + access_token))
    teacher = Teacher.query(Teacher.email == data['email'], ancestor= school_key).get()
    if teacher != None:
      self.redirect('/teachers/' + str(teacher.key.id()))
    else:
      student = Student.query(Student.email == data['email'], ancestor=school_key).get()
      if student != None:
        self.redirect('/students/' + str(student.key.id()))
      else:
        template = JINJA_ENVIRONMENT.get_template('views/error.html')
        self.response.write(template.render({'url': '/fblogout', }))
#    template = JINJA_ENVIRONMENT.get_template('views/test.html')
#    self.response.write(template.render({'data':json.dumps(data)}))

class Teachers(webapp2.RequestHandler):

  def get(self, *args, **kwargs):
    user = users.get_current_user()
    if user:
      u = urlparse(self.request.uri)
      url = users.create_logout_url(urlunparse((u[0], u[1], '', '', '', '')))
    else:
      url = '/'
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id'])])
    k = ndb.Key(flat=s)
    teacher = Teacher.query(Teacher.key == k).get()
    lessons = Lesson.query(ancestor=teacher.key)
    template_values = {
      'MULTI': MULTI,
      'SINGLE': SINGLE,
      'url': url,
      'teacher': teacher.email,
      'teacher_id': kwargs['teacher_id'],
      'lessons': lessons,
    }
    template = JINJA_ENVIRONMENT.get_template('views/teacher.html')
    self.response.write(template.render(template_values))

def teacher_question( q ):
  question = { 'id': q.key.id(), 'text': q.text, 'dirty': q.dirty, 'type': q.type, 'answers': q.answers }
  if hasattr(q, 'correct'):
    question['correct'] = q.correct
  return question

class Lessons(webapp2.RequestHandler):

  def post(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id'])])
    teacher = ndb.Key(flat=s)
    lesson = Lesson(parent=teacher)
    lesson.descr = self.request.get('descr')
    lesson.videoid = self.request.get('videourl')
    lesson.pbrange = (int(self.request.get('pbstop')) << 16 ) | int(self.request.get('pbstart'))
    lesson.questions = []
    lesson.students = []
    k = lesson.put()
    if k == None:
      self.response.write('0')
    else:
      questions = json.loads(self.request.get('questions'))
      for q in questions:
        question = Question(text=q['text'], dirty=q['dirty'], type=q['type'], answers=q['answers'], parent=k)
        if 'correct' in q:
          question.correct = q['correct']
        key = question.put()
        lesson.questions.append(key.id())
      lesson.students = json.loads(self.request.get('students'))
      lesson.put()
      resp = { 'id': k.id(), 'questions': lesson.questions }
      self.response.write(json.dumps(resp))

  def get(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
    k = ndb.Key(flat=s)
    lesson = k.get()
    les = { 'descr': lesson.descr, 'video_id': lesson.videoid }
    questions = Question.query(ancestor=k).fetch()
    if self.request.get('student') == '':
      for q in map(teacher_question, questions):
        idx = lesson.questions.index(q['id'])
        lesson.questions[idx] = q
      les['questions'] = lesson.questions
      students = [ ndb.Key('Student', id, parent=school_key) for id in lesson.students ]
      students = ndb.get_multi(students)
      les['students'] = [ { 'id': s.key.id(), 'first': s.first, 'last': s.last, 'email': s.email } for s in students ]
    else:
      clean = {}
      for q in questions:
        if q.dirty == 0:
          question = { 'text': q.text, 'type': q.type, 'id': q.key.id() }
          if q.type == 'multi':
            question['answers'] = q.answers
          clean[question['id']] = question
      les['questions'] = [ clean[q] for q in lesson.questions if q in clean ]
    les['pbstart'] = lesson.pbrange & 65535  # 16 one's
    les['pbstop'] = lesson.pbrange >> 16
    js = json.dumps(les)
    self.response.write(js)

  def put(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
    k = ndb.Key(flat=s)
    lesson = k.get()
    lesson.descr = self.request.get('descr')
    lesson.videoid = self.request.get('videourl')
    lesson.pbrange = (int(self.request.get('pbstop')) << 16 ) | int(self.request.get('pbstart'))
    current = set(lesson.questions)
    questions = json.loads(self.request.get('questions'))
    students = json.loads(self.request.get('students'))
    new = { q['id'] for q in questions if 'id' in q }
    deletion = [ ndb.Key('Question', id, parent=k) for id in current - new ]
    ndb.delete_multi(deletion)
    updates = []
    for q in questions:
      if 'id' in q:
        question = Question(key=ndb.Key('Question', int(q['id']), parent=k), text=q['text'], type=q['type'], dirty=q['dirty'], answers=q['answers'])
      else:
        question = Question(parent=k, text=q['text'], type=q['type'], dirty=q['dirty'], answers=q['answers'])
      if 'correct' in q:
        question.correct = q['correct']
      updates.append(question)
    keys = ndb.put_multi(updates)
    lesson.questions = [ key.id() for key in keys ]
    lesson.students = students
#    lesson.questions = self.request.get('questions')
    lesson.put()
    resp = { 'id': k.id(), 'questions': lesson.questions }
    self.response.write(json.dumps(resp))

  def delete(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
    k = ndb.Key(flat=s)
    k.delete()
    self.response.write('OK')

class Students(webapp2.RequestHandler):

  def get(self, *args, **kwargs):
    user = users.get_current_user()
    if user:
      u = urlparse(self.request.uri)
      url = users.create_logout_url(urlunparse((u[0], u[1], '', '', '', '')))
    else:
      url = '/'
    s = list(school_key.flat())
    s.extend(['Student', long(kwargs['student_id'])])
    k = ndb.Key(flat=s)
    student = k.get()
    template = JINJA_ENVIRONMENT.get_template('views/student.html')
    self.response.write(template.render({'mail': student.email, 'url': url}))

class Questions(webapp2.RequestHandler):

  def put(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id']), 'Question', long(kwargs['question_id'])])
    k = ndb.Key(flat=s)
    question = k.get()
    if question == None:
      question = Question(id=self.request.get('id'), parent=ndb.Key(flat=s[:-2]))
    question.text = self.request.get('text')
    question.dirty = int(self.request.get('dirty'))
    question.type = self.request.get('type')
    question.answers = json.loads(self.request.get('answers'))
    if self.request.get('correct'):
      question.correct = self.request.get('correct')
    question.put()

class Views(webapp2.RequestHandler):

  def post(self, *args, **kwargs):
    s = list(school_key.flat())
    s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
    k = ndb.Key(flat=s)
    lesson = k.get()
    view = View()
    student = list(school_key.flat())
    student.extend(['Student', long(self.request.get('student'))])
    view.student = ndb.Key(flat=student)
    view.submitted = 'true' == self.request.get('submitted')
    view.answers = json.loads(self.request.get('answers'))
    view.actions = self.request.get('actions')
    lesson.views.append(view)
    lesson.put()

def teachers_list(request, *args, **kwargs):
  if request.get('lessons'):
    student = long(request.get('student'))
    lessons = Lesson.query(Lesson.students==student).fetch(keys_only=True)
    if lessons:
#      response = [lesson.key.parent().id() for lesson in lessons]
      lesson_count = {}
      teachers = []
      for lesson in lessons:
        id = lesson.parent().id()
        if id in lesson_count:
          lesson_count[id] += 1
        else:
          lesson_count[id] = 1
          teachers.append(lesson.parent())
      teachers = ndb.get_multi(teachers)
      response = []
      for teacher in teachers:
        id = teacher.key.id()
        t = {'first': teacher.first, 'last': teacher.last, 'lessons': lesson_count[id], 'id': id}
        response.append(t)
    else:
      response = 'No lessons'
  else:
    teachers = Teacher.query().fetch()
    response = [teacher.first for teacher in teachers]
  return webapp2.Response(json.dumps(response))

def students_list(request, *args, **kwargs):
  students = Student.query(ancestor=school_key).fetch()
  response = []
  for student in students:
    id = student.key.id()
    s = {'first': student.first, 'last': student.last, 'email': student.email, 'id': id }
    response.append( s )
  return webapp2.Response(json.dumps(response))

def lessons_list(request, *args, **kwargs):
  s = list(school_key.flat())
  s.extend(['Teacher', long(kwargs['teacher_id'])])
  k = ndb.Key(flat=s)
  student = long(request.get('student'))
  lessons = Lesson.query(Lesson.students==student,ancestor=k).fetch(projection=[Lesson.descr])
  response = {'teacher_id': kwargs['teacher_id']}
  response['lessons'] = [{'descr': lesson.descr, 'id': lesson.key.id()} for lesson in lessons]
  return webapp2.Response(json.dumps(response))

def teachers_statistics(request, *args, **kwargs):
  s = list(school_key.flat())
  s.extend(['Teacher', long(kwargs['teacher_id'])])
  k = ndb.Key(flat=s)
  lessons = Lesson.query(ancestor=k).fetch()
  response = {'no_lessons': len(lessons), 'no_views': 0}
  s = set()
  for lesson in lessons:
    students = [ view.student for view in lesson.views ]
    s = s | set(students)
    response['no_views'] = response['no_views'] + len(lesson.views)
  response['no_students'] = len(s)
  return webapp2.Response(json.dumps(response))

def students_statistics(request, *args, **kwargs):
  s = list(school_key.flat())
  s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
  k = ndb.Key(flat=s)
  lesson = k.get()
  q = [ndb.Key('Question', question, parent=k) for question in lesson.questions]
  questions = ndb.get_multi(q)
#  s = [ndb.Key('Student', student, parent=school_key) for student in lesson.students]
#  students = ndb.get_multi(s)
  multi = {q.key.id(): q.correct for q in questions if q.type == 'multi' and q.dirty == 0}
  views = [ view for view in lesson.views if view.submitted == True ]
  views.sort(key=attrgetter('student', 'date'), reverse=True)
  last_views = {}
  student = ''
  students = []
  response = {}
  for view in views:
    if view.student != student:
      students.append(view.student)
      answers = {}
      for answer in view.answers:
        if answer['question'] in multi:
          if answer['answer'] == multi[answer['question']]:
            answers[answer['question']] = True
          else:
            answers[answer['question']] = False
      last_views[view.student.id()] = answers
      student = view.student
  students = ndb.get_multi(students)
  response['last_views'] = last_views
  response['questions'] = {q.key.id(): q.text for q in questions if q.type == 'multi' and q.dirty == 0}
  response['students'] = {s.key.id(): {'first': s.first, 'last': s.last} for s in students}
  response['lesson'] = {'descr': lesson.descr, 'questions': lesson.questions, 'students': lesson.students, 'id': lesson.key.id() }
  template = JINJA_ENVIRONMENT.get_template('views/students_stats.html')
  return webapp2.Response(template.render(response))

def student_statistics(request, *args, **kwargs):
  s = list(school_key.flat())
  s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
  k = ndb.Key(flat=s)
  lesson = k.get()
  q = [ndb.Key('Question', question, parent=k) for question in lesson.questions]
  questions = ndb.get_multi(q)
  s = ndb.Key('Student', long(kwargs['student_id']), parent=school_key)
  student = s.get()
  views = [view for view in lesson.views if view.student == s and view.submitted == True]
  views.sort(key=attrgetter('date'), reverse=True)
  last = views[0]
  last.answers =  {ans['question']: ans['answer'] for ans in last.answers}
  answers = []
  for q in questions:
    answer = {'question': q.text}
    if q.key.id() in last.answers:
      if q.type == 'multi':
        answer['text'] = q.answers[long(last.answers[q.key.id()])]
        if q.correct == last.answers[q.key.id()]:
          answer['correct'] = True
        else:
          answer['correct'] = False
      else:
        answer['text'] = last.answers[q.key.id()]
    answers.append(answer)
  response = {}
  response['lesson'] = {'descr': lesson.descr }
  response['student'] = {'first': student.first, 'last': student.last }
  response['answers'] = answers
  template = JINJA_ENVIRONMENT.get_template('views/student_stats.html')
  return webapp2.Response(template.render(response))

def student_stats(request, *args, **kwargs):
  k = ndb.Key('Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id']), parent=school_key)
  lesson = k.get()
  s = ndb.Key('Student', long(kwargs['student_id']), parent=school_key)
  actions = []
  for view in lesson.views:
    if view.student == s:
      actions.extend(view.actions.split(' ')[1:])
  act = [ int(x) for x in actions ]
  timeline = [0] * ((lesson.pbrange >> 16) - (lesson.pbrange & 65535))
  for action in act:
    stop = action & 65535
    start = action >> 16
    if start > stop:
      slice = xrange(stop, start+1)
      val = -1
    else:
      slice = xrange(start, stop+1)
      val = 1
    for x in slice:
      timeline[x] = timeline[x] + val
  return webapp2.Response(json.dumps(timeline))

def lesson_statistics(request, *args, **kwargs):
  s = list(school_key.flat())
  s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
  k = ndb.Key(flat=s)
  lesson = k.get()
  students = [ view.student for view in lesson.views ]
  response = {'no_views': len(lesson.views), 'no_students': len(set(students))}
  q = [ndb.Key('Question', question, parent=k) for question in lesson.questions]
  questions = ndb.get_multi(q)
  response['no_questions'] = len(questions)
  multi = {q.key.id(): {'correct': q.correct, 'right': 0, 'wrong': 0} for q in questions if q.type == 'multi' and q.dirty == 0}
  response['no_multi'] = len(multi)
  right = 0
  wrong = 0
  actions = []
  for view in lesson.views:
    actions.extend(view.actions.split(' ')[1:])
    for answer in view.answers:
      if answer['question'] in multi:
        if answer['answer'] == multi[answer['question']]['correct']:
          multi[answer['question']]['right'] = multi[answer['question']]['right'] + 1
          right = right + 1
        else:
          multi[answer['question']]['wrong'] = multi[answer['question']]['wrong'] + 1
          wrong = wrong + 1
  for q in multi:
    del multi[q]['correct']
  response['correct'] = right
  response['errors'] = wrong
  response['multi'] = multi
  act = [ int(x) for x in actions ]
  timeline = [0] * ((lesson.pbrange >> 16) - (lesson.pbrange & 65535))
#  test = []
  for action in act:
    stop = action & 65535
    start = action >> 16
    if start > stop:
      slice = xrange(stop, start+1)
      val = -1
    else:
      slice = xrange(start, stop+1)
      val = 1
    for x in slice:
#      test.append(x)
      timeline[x] = timeline[x] + val
  response['actions'] = timeline
  return webapp2.Response(json.dumps(response))

def google(request, *args, **kwargs):
  user = users.get_current_user()
  if user:
    url = users.create_logout_url(request.uri)
    teacher = Teacher.query(Teacher.email == user.email(), ancestor=school_key).get()
    if teacher != None:
      return webapp2.redirect('/teachers/' + str(teacher.key.id()))
    else:
      student = Student.query(Student.email == user.email(), ancestor=school_key).get()
      if student != None:
        return webapp2.redirect('/students/' + str(student.key.id()))
      else:
        template = JINJA_ENVIRONMENT.get_template('views/error.html')
        return webapp2.Response(template.render({'url': url, }))
  else:
    return webapp2.redirect(users.create_login_url(request.uri))

application = webapp2.WSGIApplication([
  webapp2.Route(r'/', handler=MainPage, name='home'),
  webapp2.Route(r'/fblogin', handler=FB, handler_method='FBLogin'),
  webapp2.Route(r'/fbresponse', handler=FB, handler_method='FBResponse'),
  webapp2.Route(r'/glogin', google),
  webapp2.Route(r'/teachers', teachers_list),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons', lessons_list),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/statistics', teachers_statistics),
  webapp2.Route(r'/teachers/<teacher_id:\d+>', handler=Teachers, name='teacher'),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/', handler=Lessons, name='new-lesson'),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>', handler=Lessons, name='lesson'),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/statistics', lesson_statistics),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/students_statistics', students_statistics),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/students_statistics/<student_id:\d+>', student_statistics),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/student_statistics/<student_id:\d+>', student_stats),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/questions/<question_id:\d+>', handler=Questions, name='questions'),
  webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>/views/', handler=Views),
  webapp2.Route(r'/students', students_list),
  webapp2.Route(r'/students/<student_id:\d+>', handler=Students),
  webapp2.Route(r'/newdata', newdata)
], debug=True)
