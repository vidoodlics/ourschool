from google.appengine.ext import ndb

school_key = ndb.Key('School', 'Ionio')

class Teacher(ndb.Model):
	email = ndb.StringProperty()
	first = ndb.StringProperty()
	last = ndb.StringProperty()

class Question(ndb.Expando):
  dirty = ndb.IntegerProperty()
  text = ndb.StringProperty()
  type = ndb.StringProperty()
  answers = ndb.StringProperty(repeated=True)

class View(ndb.Model):
  student = ndb.KeyProperty()
  date = ndb.DateTimeProperty(auto_now_add=True)
  actions = ndb.TextProperty()
  submitted = ndb.BooleanProperty()
  answers = ndb.JsonProperty()

class Lesson(ndb.Model):
  descr = ndb.StringProperty()
  videoid = ndb.StringProperty()
  pbrange = ndb.IntegerProperty()
  questions = ndb.IntegerProperty(repeated=True)
  students = ndb.IntegerProperty(repeated=True)
  views = ndb.StructuredProperty(View, repeated=True)

class Student(ndb.Model):
  email = ndb.StringProperty()
  first = ndb.StringProperty()
  last = ndb.StringProperty()

