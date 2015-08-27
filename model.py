from google.appengine.ext import ndb

school_key = ndb.Key('School', 'Ionio')

class Teacher(ndb.Model):
	email = ndb.StringProperty()
	first = ndb.StringProperty()
	last = ndb.StringProperty()
  
class Lesson(ndb.Model):
	descr = ndb.StringProperty()
	videoid = ndb.StringProperty()
	pbrange = ndb.IntegerProperty()
	questions = ndb.JsonProperty()
	