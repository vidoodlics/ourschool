import os
import urllib
import json

from urlparse import urlparse
from urlparse import urlunparse

from google.appengine.api import users
from google.appengine.ext import ndb

import jinja2
import webapp2

import model

Teacher = model.Teacher
Lesson = model.Lesson
school_key = model.school_key
SINGLE = 1
MULTI = 2
JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=False,
    variable_start_string='{!',
    variable_end_string='!}',
    trim_blocks=True)

class MainPage(webapp2.RequestHandler):

	def get(self):
		user = users.get_current_user()
		if user:
			url = users.create_logout_url(self.request.uri)
			teacher = Teacher.query(Teacher.email == user.email(), ancestor=school_key).get()
			if teacher != None:
				self.redirect('/teachers/' + str(teacher.key.id()))
			else:
				sampleData()
				template = JINJA_ENVIRONMENT.get_template('views/error.html')
				self.response.write(template.render({'url': url, }))
		else:
			url = users.create_login_url(self.request.uri)
			template = JINJA_ENVIRONMENT.get_template('views/index.html')
			self.response.write(template.render({'url': url, }))

def sampleData():
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

class TeacherInput(webapp2.RequestHandler):

	def get(self):
		user = users.get_current_user()
		teacher = Teacher(parent=model.school_key)
		teacher.email = user.email();
		teacher.first = 'Spyros'
		teacher.last = 'Sagiadinos'
		teacher.put()
		self.redirect('/')

class TeacherDel(webapp2.RequestHandler):

	def get(self):
		teacher_query = Teacher.query(Teacher.first == 'Spyros')
		teacher = teacher_query.fetch(1)
		k = teacher[0].key
		k.delete()
		self.redirect('/')

class NewLesson(webapp2.RequestHandler):

	def post(self):
		s = list(school_key.flat())
		s.extend(['Teacher', long(self.request.get('teacher_id'))])
		teacher = ndb.Key(flat=s)
		lesson = Lesson(parent=teacher)
		lesson.descr = self.request.get('descr')
		lesson.videoid = self.request.get('videourl')
#		lesson.questions = json.loads(self.request.get('questions'))
		lesson.questions = self.request.get('questions')
		k = lesson.put()
		if k == None:
			self.response.write('0')
		else:
			self.response.write(k.id())

class Teachers(webapp2.RequestHandler):
	
	def get(self, *args, **kwargs):
		user = users.get_current_user()
		u = urlparse(self.request.uri)
		url = users.create_logout_url(urlunparse((u[0], u[1], '', '', '', '')))
		s = list(school_key.flat())
		s.extend(['Teacher', long(kwargs['teacher_id'])])
		k = ndb.Key(flat=s)
		teacher = Teacher.query(Teacher.key == k).get()
		lessons = Lesson.query(ancestor=teacher.key)
		les = [ { 'descr': 'Spyros', 'id': 1 }, { 'descr': 'Sagiadinos', 'id': 2 } ];
		template_values = {
			'MULTI': MULTI,
			'SINGLE': SINGLE,
 			'url': url,
 			'teacher': teacher.email,
 			'teacher_id': kwargs['teacher_id'],
 			'lessons': lessons,
 			'lessonsjs': les
 		}
		template = JINJA_ENVIRONMENT.get_template('views/teacher.html')
		self.response.write(template.render(template_values))
		
class Lessons(webapp2.RequestHandler):

	def post(self, *args, **kwargs):
		s = list(school_key.flat())
		s.extend(['Teacher', long(kwargs['teacher_id'])])
		teacher = ndb.Key(flat=s)
		lesson = Lesson(parent=teacher)
		lesson.descr = self.request.get('descr')
		lesson.videoid = self.request.get('videourl')
#		lesson.questions = json.loads(self.request.get('questions'))
		lesson.questions = self.request.get('questions')
		k = lesson.put()
		if k == None:
			self.response.write('0')
		else:
			self.response.write(k.id())
			
	def get(self, *args, **kwargs):
		s = list(school_key.flat())
		s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
		k = ndb.Key(flat=s)
		lesson = Lesson.query(Lesson.key == k).get()
		les = { 'descr': lesson.descr, 'video_id': lesson.videoid, 'questions': lesson.key.id() }
		js = json.dumps(les).replace( str(lesson.key.id()), lesson.questions )
		self.response.write(js)

	def put(self, *args, **kwargs):
		s = list(school_key.flat())
		s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
		k = ndb.Key(flat=s)
		lesson = Lesson(key = k)
		lesson.descr = self.request.get('descr')
		lesson.videoid = self.request.get('videourl')
#		lesson.questions = json.loads(self.request.get('questions'))
		lesson.questions = self.request.get('questions')
		lesson.put()
		self.response.write('OK')

	def delete(self, *args, **kwargs):
		s = list(school_key.flat())
		s.extend(['Teacher', long(kwargs['teacher_id']), 'Lesson', long(kwargs['lesson_id'])])
		k = ndb.Key(flat=s)
		k.delete()
		self.response.write('OK')
		
application = webapp2.WSGIApplication([
    webapp2.Route(r'/', handler=MainPage, name='home'),
    webapp2.Route(r'/teachers/<teacher_id:\d+>', handler=Teachers, name='teacher'),
    webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons', handler=Lessons, name='new-lesson'),
    webapp2.Route(r'/teachers/<teacher_id:\d+>/lessons/<lesson_id:\d+>', handler=Lessons, name='lesson')
], debug=True)