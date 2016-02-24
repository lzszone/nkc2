//helper module

module.paths.push(__projectroot + 'nkc_modules');
//dependencies
var moment = require('moment');
var os = require('os');
var colors = require('colors');
var fs = require('fs');
var async = require('async');

module.exports = function(){

  //dashline generator
  this.dash=function(){
    console.log("-------------------------------------------------------".green);
  };

  //reformat a post after retrieval
  this.postRepack = function(p){
    delete p._rev;
    return p;
    return {
      pid:p._id,
      uid:p.uid,
      tid:p.tid,
      timecreated:p.toc,
      content:p.content
    };
  };

  //request logger
  this.requestLog = function (req){
    var d=new Date();
    dash();
    console.log(dateString(d).cyan,
    req.ip, req.method, req.originalUrl.cyan);
  };

  //error reporter
  this.report = function(description,err){
    if(err){
      console.log(dateString(),"err:",description.red);
      console.log(err.toString().red);
      return({'error':description,'detail':err.toString()});
    }else{
      console.log(dateString().yellow,description);

      if(typeof(description)!='object'){
        return {'message':description};
      }
      else {
        return description;
      }
    }
  };

  //datestring generator
  this.dateString = function(date){
    var dateformat="YYYY-MM-DD HH:mm:ss";

    if(date)//if input contains date
    {
      return moment(date).format(dateformat);
      //
      return (date.toISOString().
      replace('T', ' ').      // replace T with a space
      substr(0,19));
    }
    else
    {
      return moment().format(dateformat);
      //
      return (new Date().toISOString().
      replace('T', ' ').      // replace T with a space
      substr(0,19)); //delete trails
    }
  };

  ///----
  ///osinfo helper
  this.osinfo = function(){
    var kv={};
    Object.keys(os).map(function(method) {
      try{
        kv[method] = os[method]();
      }
      catch(err){
        //report('err during \'os\' listing',err);
        //supressed!
        kv[method] = os[method];
      }
    });
    return kv;
  };

  this.msgform = function(title,user,content,misc)
  {
    if(misc){
      return JSON.stringify({'title':title,'user':user,'content':content,'misc':misc});
    }
    return JSON.stringify({'title':title,'user':user,'content':content});
  };

  this.check_single_file_exist = function(path,callback){
    fs.access(path, fs.R_OK , function(err){
      err?callback(false):callback(true);
    });
  };

  this.fastest_file_from_paths = function(directories,filename,callback){
    var fastest_file = '';
    async.some(
      directories,
      function(directory,callback_percase){
        this.check_single_file_exist(directory+filename,function(exists){
          if(exists){
            fastest_file = directory+filename;
          }
          callback_percase(exists);
        });
      },
      function(finallyexists){
        if(!finallyexists){
          //if file not exist everywhere
          callback('not exist anywhere!!');
          return;
        }
        callback(null,fastest_file);
      }
    );
  }



}
