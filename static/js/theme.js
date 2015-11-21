(function(window) {

  window.audioSwtr = window.audioSwtr || {};

  //testing audioSwtr
  audioSwtr.playArea = Backbone.View.extend({
    el: "#audio-play-area",
    events: {
      "click #submit-form" : "submitToDa",
      "change input" : "emojiChange",
      "click .suggest-tag-item" : "addTagViz",
      "click .fav-button" : "favClick",
      "click .dislike-button" : "dislikeClick",
      "click #cancel-form" : "toggle"
    },
    initialize: function(options) {
       var modelId = options.id || '';
      this.model = audioTagApp.station.audioCollection.get(modelId);
      this.swtrTemplate = _.template($('#sweets-template').html());
      this.tagsListTemplate = _.template($('#tags-list-template').html());
      this.alertsTemplate = _.template($('#alert-template').html());
      this.listenTo(audioTagApp.station.sudioCollection, 'add', this.swtsRender);
      this.render();
    },
    template: _.template($('#play-item-template').html()),
    render: function() {
        if(this.$el.is(':hidden')){
            this.toggle();
        }
        this.$el.html('');
        this.$el.append(this.template(this.model.toJSON()));
        $("body").scrollTop(0); //this.$el should do this, but unable to get it working
        this.$tags = $("#add-tag");
        this.$tags.tagsinput();
        //TODO: should figure our how to get inputs and build array
        this.renderTags();
    },
     submitToDa: function(event) {
        event.preventDefault();
        if(audioSwtr.user_email) {
            $.ajax({
                type: "post",
                url: "http://da.pantoto.org/api/tags/"+this.model.id,
                data: {tags: $("#add-tag").tagsinput('items')},
                context: this,
                success: function(resp) {
                    this.model.get('tags').push($("#add-tag").tagsinput('items'));
                    this.renderTags();
                },
                error: function() {
                    console.log("error!!");
                }
            });
        }
        else {
          this.$el.prepend(this.alertsTemplate({message: "You need to Sign In" }));
        }
    },
    renderTags: function() {
        this.$el.find('.tag-editor .recent-feed-data').remove();
        this.$el.find('.tag-editor').append(this.tagsListTemplate({"tags": this.model.get('tags'), "id": this.model.get('id')}));
        this.$el.find('#add-tag').tagsinput('removeAll');
    },
    submitForm: function(event) {
      event.stopPropagation();
      audioTagApp.dashboard.playArea.$el.find('.alert').remove();
      if(audioSwtr.access_token){
          this.$tags = $("#add-tag");
          if(!(this.$el.find('input').val()=="")){
              this.newTags = this.$tags.tagsinput('items');
              console.log(this.newTags, "submit form");
              this.swtrBuild();
          }
      }
      else if(!audioSwtr.access_token) {
          this.$el.prepend(this.alertsTemplate({message: "You need to Sign In" }));
      }
    },
    addTagViz: function(event) {
        event.stopPropagation();
        var clickedTag = $(event.currentTarget).text();
        console.log(clickedTag);
        this.$el.find('input').val(clickedTag);
    },
    favClick: function(event) {
        //this method does not work here like dashboardview
        //need to fig a way out to handle the social stats globally
        //or pass swt parameters to the play area view
        event.stopPropagation();
        if(audioSwtr.access_token){
            var data = $(event.currentTarget).data('like');
            var audioModel = this.collection.get($(event.currentTarget).data("id"));
            //TODO: Bug: one user can send multiple like sweets for one audio
            //dom won't refresh(as required) - Swts get posted(should check
            //for users who have liked alread
            var swt = [{
                who: audioSwtr.who,
                what: audioSwtr.allowedContexts,
                where: audioModel.get('url'),
                how: {like: true}
            }];
            audioSwtr.storeCollection.add(swt);
            //swts to be posted
            var swtsToPost = JSON.stringify(audioSwtr.storeCollection.getNew());
            audioSwtr.storeCollection.post(swtsToPost);
            //TODO: after posting data, need to render view
            $(event.currentTarget).find('.feed-data').html(++data);
            $(event.currentTarget).attr('data-like', data);
            console.log("like", data);
            this.$el.prepend(this.alertsTemplate({message: "Swt posted to the Store" }));
        }
        else if(!audioSwtr.access_token) {
            this.$el.prepend(this.alertsTemplate({message: "You need to Sign In" }));
        }
    },
    toggle: function() {
        if(this.$el.is(':visible')) {
            this.$el.hide();
            console.log("visible");
        }
        else {
            this.$el.show();
            console.log("hidden");
        }
    }
  });

  //default audio collection, with file identifiers
  //like ID, date-time stamp, tags(if available)
  var audioCollection = Backbone.Collection.extend({
    model: Backbone.Model,
    initialize: function(options) {
      this.url = options.url;
    },
    comparator: function(model) {
      return -Date.parse(model.get("date"));
    }
  });


  //admin control panel
  //
  var adminDash = Backbone.View.extend({
    el: "#auth-form",
    events: {
      "click button": "authSubmit"
    },
    initialize: function() {
    },
    render: function() {
    },
    authSubmit: function() {
      $.ajax({
        type: 'POST',
        url: 'http://da.pantoto.org/api/user',
        data: {'usertel': $('#phone-number').val()},
        success: function(response) {
        },
        error: function() {
        }

      });

    }
  });


  //upload audio url view
  var uploadUrl = Backbone.View.extend({
    el: "#upload-form",
    events: {
      "click button" : "submitUrl"
    },
    initialize: function() {
      this.url = $('#upload-input').val();
    },
    render: function() {
    },
    submitUrl: function(event) {
      event.preventDefault();
      if(this.url){
        $.ajax({
          type: 'POST',
          url: 'http://da.pantoto.org/api/url',
          data: {'url': this.url },
          success: function(response) {
          },
          error: function() {
            console.log("caught error");
          }

        });
      }
    }
  });

  //Get request from the server endpoint
  //api:
  // list view for the audio files, sorted by date-time stamp
  // with other attributes from database
var dashboardview = Backbone.View.extend({
    events: {
        //"click .feed-data .suggest-tag-item" : "searchTag",
        "click .add-tag-button" : "playClick",
        "click .fav-button" : "favClick",
        "click .share-button" : "shareClick",
        "click .dislike-button" : "dislikeClick"
    },
    initialize: function(options) {
	    this.$el.html('');
        this.$sideMenu = $("#side-menu-wrap");
        this.alertsTemplate = _.template($('#alert-template').html());
        this.listenTo(this.collection, "set", this.render);
        if(this.$el.parent().siblings().is(':visible')){
            this.$el.parent().siblings().hide();
        }
    },
    template: _.template($('#audio-item-template').html()),
    dummyrender: function() {
       /* this.collection.each(function(item) {
            this.$el.append(this.template(item.toJSON()));
        }, this);
        $('[data-toggle="tooltip"]').tooltip();
        this.$sideMenu.BootSideMenu({
            side: "right",
            autoClose: true});*/
    },
    render: function() {
        this.collection.each(function(item) {
            this.$el.append(this.template({
                id: item.get('id'),
                url: item.get('url'),
                uploadDate: item.get('uploadDate'),
                tags: item.get('tags')
            }));
        }, this);
        if(audioTagApp.station.dashboard.$el.is(':hidden')) {
            audioTagApp.station.dashboard.toggle();

        }
        audioTagApp.station.tagCloud.toggle()
            $("#dashboard .loader").remove();
    },
    playClick: function(event) {
        event.preventDefault();
        playArea = new audioSwtr.playArea({id: $(event.currentTarget).data("id")});
        //audioSwtr.app_router.play({id: $(event.currentTarget).data("id")});
        if(this.$el.is(":visible")){
            this.toggle();
        }
    },
    searchTag: function(event) {
        event.stopPropagation();
        searchView = new searchTagView({keyword : ($(event.currentTarget).text().trim())});
        console.log ($(event.currentTarget).text().trim());
    },
    toggle: function() {
        if(this.$el.is(':visible')) {
            this.$el.hide();
            console.log("visible");
        }
        else {
            this.$el.show();
            console.log("hidden");
        }
    }


});

  var searchTagView = Backbone.View.extend({
    el: "#search-results-container",
    template: _.template($('#audio-item-template').html()),
    events: {
      "click .post-card-footer button": "callPlayArea"
    },
    initialize: function(options) {
        //_.bindAll(this, 'callPlayArea');
        this.keyword = options.keyword || '';
        this.searchHeaderTemplate = _.template($('#search-header-template').html());
        console.log(options);
        this.listenTo(audioSwtr.storeCollection, "add", this.render);
        this.render();
    },
    render: function() {
        $(this.el).html('');
        $("#audio-play-area").html('');
      this.searchResults = audioTagApp.station.dashboard.collection.models.filter(function(swt) {
      console.log(this.keyword, swt.get('tags'));
      return _.contains(swt.get('tags'), this.keyword);
      }, this);
      if(this.keyword){
           this.$el.prepend(this.searchHeaderTemplate({message: "<h3>"+this.keyword+" </h3> has <h3>"+this.searchResults.length+"</h3> Audios" }));
        }
      console.log(this.searchResults);
      //bug - need to fix
      if(audioTagApp.station.dashboard.$el.is(':visible')) {
        audioTagApp.station.dashboard.toggle();
      }
      if(this.$el.is(":hidden")) {
          this.toggle();
      }
      _.each(this.searchResults, function(item) {
        $(this.el).append(this.template(item.toJSON()));
      }, this);
    },
    callPlayArea: function(event) {
        event.stopPropagation();
        playArea = new audioSwtr.playArea({id: $(event.currentTarget).data("id")});
        if(this.$el.is(":visible")){
            this.toggle();
        }
    },
    toggle: function() {
      if(this.$el.is(':visible')) {
        this.$el.hide();
        console.log("visible");
      }
      else {
        this.$el.show();
        console.log("hidden");
      }
    }
  });


  //visualization for tags, user and other file attributes
  // to be extended with drag and drop to tagsinput field
  var tagCloudView = Backbone.View.extend({
    el: "#tag-cloud",
    events: {
      "click li" : "searchTag"
    },
    initialize: function() {
      this.$tagClouds = $("#tag-clouds");
      this.$searchForm = $("#input-keyword");
      this.listTemplate = _.template($("#stations-template").html());
      this.listenTo(audioTagApp.station.audioCollection, "add", this.render);
    },
    render: function() {
        this.$el.html('');
        $("#audio-play-area").html('');
        this.$el.append('<li class="list-group-item"><strong>Browse audio by Tags</strong></li>');
        var wordArray = _.map(_.countBy(_.flatten(audioTagApp.station.dashboard.collection.pluck('tags'))), function(val, key){
                return {text: key, weight:val};
        });
        /*var wordArray = _.chain(this.collection).pluck('tags').flatten().countBy().map(function(val, key){
            return {text: key, weight:val};
        });*/
        //this.$el.jQCloud(wordArray);
        _.each(wordArray, function(item) {
            this.$el.append(this.listTemplate({name: item.text}));
        }, this);
    },
    toggle: function() {
        if(this.$el.is(':visible')) {
            this.$el.hide();
            console.log("visible");
        }
        else {
            this.$el.show();
            console.log("hidden");
        }
    },
    searchTag: function(event) {
      event.preventDefault();
      searchView = new searchTagView({keyword:($(event.currentTarget).text().trim())});
    }

  });

landingView = Backbone.View.extend({
    el: "#landing-content",
    initialize: function() {
        this.landingTemplate = _.template($("#landing-template").html());
        this.render();
    },
    render: function() {
        this.$el.append(this.landingTemplate());
    }
});

stationListView = Backbone.View.extend({
    el: "#channel-list",
    events: {
        "click li" : "callDash"
    },
    initialize: function(options) {
        this.list = stations;
        console.log(this.list);
        this.listTemplate = _.template($("#stations-template").html());
        this.render();
    },

    render: function(){
        _.each(this.list.stations, function(station) {
            console.log(station);
            this.$el.find('ul').append(this.listTemplate(station));
        }, this);
	
    },
    callDash: function(event) {

        audioTagApp.landing.$el.hide();
        $("#homeAnchor").text($(event.currentTarget).text().toUpperCase());
        this.audioCollection = new audioCollection({ url: "http://da.pantoto.org/api/stn/"+$(event.currentTarget).text()});
        $("#dashboard").prepend("<div class='loader' style='margin-top:-150px'><img src='static/img/PAPAD5.png' /></div>");
        this.audioCollection.fetch({
            success: function(collection, response) {
                collection.set(response.files);
                audioTagApp.station.dashboard.render();
            },
            error: function(collection) {
                console.log("Error!! Error!!", collection);
            }
        });
        this.dashboard = new dashboardview({el:"#dashboard-body",
            collection: this.audioCollection });
        this.tagCloud = new tagCloudView({collection: this.audioCollection});
        $(".wrapper").toggleClass("active");
        $('.side_name').toggleClass("active");
        $("#search-results-container").html('');
    }
});

var appview = Backbone.View.extend({
    el: $('body'),
    events:{
        "click #homeAnchor": "callDashboard",
        'click #sign-in': 'signIn',
        'click #sign-out': 'signOut'
    },
    initialize: function(options) {
        _.bindAll(this, 'callDashboard');

        // initialize the oauth stuff
        this.oauth = new Oauth({
            app_id: audioSwtr.app_id,
            endpoint: audioSwtr.swtstoreURL() + audioSwtr.endpoints.auth,
            redirect_uri: audioSwtr.oauth_redirect_uri,
            scopes: 'email,sweet,context'
        });
        this.station= new stationListView();
        this.landing = new landingView();
        $("#audio-play-area").html('');
        //audioSwtr.storeCollection = new audioSwtr.AudioAnnoSwts();
    },
    getSweets: function() {
        audioSwtr.storeCollection.getAll({
            what: audioSwtr.allowedContexts,
            where: null,
            success: function(data) {
                audioSwtr.storeCollection.add(data);
                audioTagApp.dashboard.render();
            }
        }, this);
    },
    filterSocialData: function() {
        this.socialData = audioSwtr.storeCollection.filter(function(item){
            if(!item.get('how').tags) {
                return item
            }
        });
    },
    render: function(){
      //this.dashboard = new dashboardview({el:"#dashboard-body",
       //                                   collection: this.audioCollection });
      //this.tagCloud = new tagCloudView({collection: audioSwtr.storeCollection});
    },
    userLoggedIn: function(username) {
        $("#signinmsg").show();
    
        /*    audioSwtr.who = username;
        var text = 'Signed in as <b><u>' + audioSwtr.who + '</u></b>';
        $('#signinview').html('Sign Out');
        $('#signinmsg').html(text);
        $(".user-state").append(_.template('<button type="button" id="sign-out" class="btn"><span class="glyphicon glyphicon-globe"></span><span id="signinview">Sign Out</span></button>'));*/
        // $.ajax({
        //   url:"http://locahost:5001/api/sweets/q?access_token="+audioSwtr.access_token,
        //   type: 'POST',
        //   crossDomain:true,
        //   data:[{who:'arvindkhadri',
        //          what:'img-anno',
        //          'where':'http://localhost:5000',
        //          how:{}}]
        // });
    },
    userLoggedOut: function() {
        $('#signinmsg').hide();
    },
    callDashboard: function(event) {
        console.log(event);
        if(audioTagApp.station.dashboard.$el.is(':hidden')) {
            audioTagApp.station.dashboard.toggle();
            $("#search-results-container").html('')
            playArea.toggle();
        }
        else {
            $("#search-results-container").html('')
        }
    }
});

window.onload = function() {
    audioTagApp = new appview;
    $(".menu-toggle").click(function(e) {
        e.preventDefault();
        $(".wrapper").toggleClass("active");
        $('.side_name').toggleClass("active");
    });			
};
})(window);
