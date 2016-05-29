module.paths.push(__projectroot + 'nkc_modules'); //enable require-ment for this path

var moment = require('moment')
var path = require('path')
var fs = require('fs.extra')
var settings = require('server_settings.js');
var helper_mod = require('helper.js')();
var queryfunc = require('query_functions')
var validation = require('validation')
var AQL = queryfunc.AQL
var apifunc = require('api_functions')

var jadeDir = __projectroot + 'nkc_modules/jade/'

var table = {};
module.exports = table;

function defaultData(params){ //default data obj for views
  var user = params?params.user:null
  return {
    site:settings.site,
    user,
    content_class:params.content_class,
  }
}

table.viewExam = {
  operation:function(params){
    var data = defaultData(params)

    data.template = 'nkc_modules/jade/interface_exam.jade' //will render if property 'template' exists

    if(params.user) throw ('to take exams, you must logout first.')

    if(params.result){
      data.detail = params.detail
      data.result = params.result
      return data;
    }

    return apifunc.exam_gen({ip:params._req.ip})
    .then(function(back){
      data.exam = back;
      return data;
    })
  },

  requiredParams:{

  },
}

table.viewRegister = {
  operation:function(params){
    var data = defaultData(params)

    data.code = params.code
    data.template = 'nkc_modules/jade/interface_user_register.jade'

    return data
  }
}

function getForumList() {
  return AQL(`
    for f in forums
    filter f.type == 'forum' && f.parentid !=null
    let nf = f

    collect parent = nf.parentid into forumgroup = nf
    let parentforum = document(forums,parent)
    let group =  {parentforum,forumgroup}
    sort group.parentforum.order asc
    return group
    `
  )
}

table.viewHome = {
  init:function(){
    queryfunc.createIndex('threads',{
      fields:['fid','disabled'],
      type:'skiplist',
      unique:'false',
      sparse:'false',
    })
  },
  operation:params=>{
    var data = defaultData(params)
    data.template = jadeDir+ 'interface_home.jade'

    var content_class = params.content_class

    return AQL(`
      for f in forums

      let class = f.class

      filter has(@content_class,TO_STRING(class)) /*content ctrl*/

      filter f.type == 'forum' && f.parentid !=null
      let threads =
      (
        for t in threads

        filter t.fid == f._key && t.disabled==null
        sort t.fid desc,t.disabled desc, t.tlm desc
        limit 0,6

        let oc = document(posts,t.oc)
        return merge(t,{oc})
      )
      let nf = merge(f,{threads})

      collect parent = nf.parentid into forumgroup = nf
      let parentforum = document(forums,parent)
      let group =  {parentforum,forumgroup}
      sort group.parentforum.order asc
      return group
      `,
      {
        content_class,
      }
    )
    .then(grouparray=>{
      data.grouparray = grouparray;
      //data.forums = forums;
      return data;
    })
  }
}

function get_all_forums(){
  return AQL
  (
    `for f in forums
    return f
    `
  )
}

table.viewForum = {
  init:function(){
    return queryfunc.createIndex('threads',{
      fields:['fid','disabled','tlm'],
      type:'skiplist',
      unique:'false',
      sparse:'false',
    })
  },
  operation:params=>{
    var data = defaultData(params)
    data.template = jadeDir+ 'interface_forum.jade'
    var fid = params.fid;

    return AQL(`
      let forum = document(forums,@fid)
      let threads = (
        for t in threads
        filter t.fid == forum._key && t.disabled==null
        sort t.fid desc, t.disabled desc, t.tlm desc
        limit @start,@count

        let oc = document(posts,t.oc)
        let lm = document(posts,t.lm)
        let ocuser = document(users,oc.uid)
        let lmuser = document(users,lm.uid)

        return merge(t,{oc,ocuser,lmuser})
      )
      return {forum,threads}

      `,
      {
        fid,
        start:0,
        count:100,
      }
    )
    .then((result)=>{
      //if nothing went wrong
      Object.assign(data,result[0])
      //return apifunc.get_all_forums()
      return getForumList()
    })
    .then(forumlist=>{
      data.forumlist = forumlist
      data.replytarget = 'forum/' + fid;
      return data
    })
  },
  requiredParams:{
    fid:String,
  }
}

table.viewThread = {
  init:function(){
    return queryfunc.createIndex('posts',{
      fields:['tid','disabled','toc'],
      type:'skiplist',
      unique:'false',
      sparse:'false',
    })
    .then(()=>{
      return queryfunc.createIndex('resources',{
        fields:['pid'],
        type:'hash',
        unique:'false',
        sparse:'false',
      })
    })
  },
  operation:params=>{
    var data=defaultData(params)
    data.template = jadeDir + 'interface_thread.jade'
    var tid = params.tid

    return AQL(
      `
      let thread = document(threads,@tid)

      let forum = document(forums,thread.fid)
      let oc = document(posts,thread.oc)

      let posts = (
        for p in posts
        sort p.tid asc, p.disabled asc, p.toc asc
        filter p.tid == thread._key && p.disabled==null

        limit 0,50

        let user = document(users,p.uid)

        let resources_declared = (
          filter is_array(p.r)
          for r in p.r
          let rd = document(resources,r)
          filter rd!=null
          return rd
        )

        let resources_assigned = (
          for r in resources
          filter r.pid == p._key
          return r
        )

        return merge(p,{
          user,
          r:union_distinct(resources_declared,resources_assigned)
        })
      )
      return {
        thread,oc,forum,posts
      }
      `,
      {
        tid,
      }
    )
    .then(result=>{
      Object.assign(data,result[0]);
    })
    .then(result=>{
      return getForumList()
    })
    .then(forumlist=>{
      data.forumlist = forumlist
      data.replytarget = 'thread/' + tid
      return data
    })
  },
  requiredParams:{
    tid:String,
  }
}

table.viewUserThreads = {
  requiredParams:{
    uid:String,
  },
  init:function(){
    queryfunc.createIndex('threads',{
      fields:['uid','disabled','tlm'],
      type:'skiplist',
      unique:'false',
      sparse:'false',
    })
  },
  operation:function(params){
    var data=defaultData(params)
    data.template = jadeDir + 'interface_forum.jade'

    var uid = params.uid

    return queryfunc.doc_load(uid,'users')
    .then(user=>{
      data.forum = {
        display_name:user.username,
        description:user.post_sign||'',
        count_threads:user.count_threads||null,
        count_posts:user.count_posts||null,
      }

      var uid = user._key
      return AQL(`
        for t in threads
        sort t.uid desc,t.disabled desc,t.tlm desc
        filter t.uid == @uid && t.disabled==null
        limit @start,@count

        let oc = document(posts,t.oc)
        let lm = document(posts,t.lm)
        let ocuser = document(users,oc.uid)
        let lmuser = document(users,lm.uid)

        return merge(t,{oc,ocuser,lmuser})
        `,
        {
          uid,
          start:0,
          count:100,
        }
      )
    })
    .then(threads=>{
      //if nothing went wrong
      data.threads = threads
      //return apifunc.get_all_forums()
      return getForumList()
    })
    .then(forumlist=>{
      data.forumlist = forumlist
      return data
    })
  }
}

table.viewLogout = {
  operation:function(params){
    var data=defaultData(params)
    data.template = jadeDir+'interface_user_logout.jade'

    data.user = undefined
    params._res.cookie('userinfo',{info:'nkc_logged_out'},{
      signed:true,
      expires:(new Date(Date.now()-86400000)),
    });

    var signed_cookie = params._res.get('set-cookie');

    //put the signed cookie in response, also
    Object.assign(data, {'cookie':signed_cookie,'instructions':
    'you have logged out. you may replace existing cookie with this one'})

    return data;
  },
}

table.viewLogin = {
  operation:params=>{
    var data = defaultData(params)
    data.template = jadeDir+'interface_user_login.jade'
    return data
  }
}

table.viewExperimental = {
  operation:params=>{
    var data = defaultData(params)
    data.template = jadeDir+'interface_experimental.jade'
    return data
  }
}
