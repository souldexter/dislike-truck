// ==UserScript==
// @name            Youtube Mass Dislike Script
// @require         https://code.jquery.com/jquery-1.11.3.min.js
// @require         https://apis.google.com/js/client.js?v=1
// @require         https://raw.githubusercontent.com/kimmobrunfeldt/progressbar.js/2af42a3a48979a72a93b989a00bf3e8e75f9f22d/dist/progressbar.js
// @namespace       dislike-truck
// @description     Source: https://github.com/1v/dislike-truck
// @include         /^https?:\/\/(www\.|)youtube\.com[/]+[\s\S]*$/
// @version         1.6.0
// @author          1v
// @grant           none
// @icon            http://img-fotki.yandex.ru/get/17846/203537249.14/0_1356dd_5dfe78f0_orig.png
// @updateURL       https://github.com/1v/dislike-truck/raw/master/dislike-truck.user.js
// @downloadURL     https://github.com/1v/dislike-truck/raw/master/dislike-truck.user.js
// @run-at          document-end
// ==/UserScript==

'use strict';

$(function() {

  var CLIENT_ID = '1006433018316-nfl9hldjnsmu422dd8umrh75dkj3q070.apps.googleusercontent.com',
      API_KEY = 'AIzaSyDdJqMRCPxHOvdpBRNxAOEGW89IiNWZsnw',
      SCOPES = 'https://www.googleapis.com/auth/youtube',
      PER_PAGE = 50,
      DELAY_TIME = 500,
      DEBUG_ENABLED = false,
      PROGRESS_BAR_WIDTH = 305,
      I18N = { en: {} };

  I18N.default = I18N.en;

  I18N.en.register_button_name = 'Register';
  I18N.en.dislike_button_name = 'Dislike';

  var debug = function(msg) {
    if (DEBUG_ENABLED) console.log(msg);
  };

  var getChannelURI = function() {
    var re = /youtube\.com\/(user|channel)\/([^\/]+)/,
        m;
    if ((m = re.exec(window.location.href)) !== null) {
      debug(m);
      var that = {};
      if (m[1] === 'user') {
        that.user = m[2];
      } else if (m[1] === 'channel') {
        that.id = m[2];
      }
      return that;
    } else {
      debug('Not a user page.');
      return false;
    }
  };

  var Progress = function() {
    var self = new ProgressBar.Line('.progressContainer', {
      color: '#CC181E',
      strokeWidth: 1,
      text: {
          value: '0',
          style: {
              left: '50%',
              top: '10px',
              margin: '0px',
              padding: '2px 0px 0px 3px',
              display: 'block',
              width: PROGRESS_BAR_WIDTH + 'px',
            },
        },
      step: function(state, bar) {
          bar.setText((bar.value() * bar.max).toFixed(0) + ' / ' + bar.max);
        },
      duration: 500,
      fill: '#CC181E',
      trailColor: '#FFB7B9',
    });

    self.increase = function() {
      self.animate(++self.current / self.max);
    };

    self.clear = function() {
      self.max = 0;
      self.current = 0;
    };

    self.clear();
    self.animate(0);

    return self;
  }, progress = {};

  /**
  * Authorize Google Youtube API.
  */
  var auth = function(immediate, callback) {
    gapi.client.setApiKey(API_KEY);
    gapi.auth.authorize({
      client_id: CLIENT_ID,
      scope: SCOPES,
      immediate: immediate
    }, callback);
  };

  function authorization(callback) {
    auth(true, function(authResult) {
        debug(authResult);
        if (authResult && !authResult.error) {
          // Authorization was successful. Hide authorization prompts and show
          // content that should be visible after authorization succeeds.
          loadAPIClientInterfaces(callback);
        } else {
          // Make the #login-link clickable. Attempt a non-immediate OAuth 2.0
          // client flow. The current function is called when that flow completes.
          auth(false, function() {
            loadAPIClientInterfaces(callback);
          });
        }
      });
  }

  function loadAPIClientInterfaces(callback) {
    debug(gapi);
    gapi.client.load('youtube', 'v3', function() {
      debug('gapi loaded');
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  // appendUnloadingButton();

  $(document).on('mouseover', function() {
    if ($('.unload-trucks').length < 1 && getChannelURI()) {
      debug(getChannelURI());
      appendUnloadingButton();
    }
  });

  function appendUnloadingButton() {
    var button = $('<span style="float: left; margin-right: 5px;"><button type="button"></button></span>');
    $('#subscribe-button')
      .before(button.clone().addClass('register-loader').find('button').text(I18N.default.register_button_name).end())
      .before(button.clone().addClass('unload-trucks').find('button').text(I18N.default.dislike_button_name).end())
      .after('<div style="position: absolute; width: ' + PROGRESS_BAR_WIDTH + 'px; height: 30px; top: 80px; right: 111px"><div class="progressContainer"></div></div>');
    progress = new Progress();
  }

  function appendSimonov(add) {
    if ($('.simonov').length < 1 && add) {
      $('.register-loader')
        .before($('<img>').attr({'src': '//img-fotki.yandex.ru/get/9515/203537249.14/0_136180_483da1b3_orig.gif',
                                  'class': 'simonov'})
                          .css({'float': 'left', 'margin-right': '5px'}));
    } else {
      $('.simonov').remove();
    }
  }

  $(document).on('click', '.register-loader', function(e) {
    e.preventDefault();
    debug('.register-loader clicked');
    auth(false, loadAPIClientInterfaces(function() {
      setTimeout(function() {
        beginDisliking(getChannelURI());
      }, 15000);
    }));
  });

  $(document).on('click', '.unload-trucks', function(e) {
    e.preventDefault();
    authorization(function() {
      beginDisliking(getChannelURI());
    });
  });

  function beginDisliking(user) {
    progress.clear();
    // if in page url "/channel/"
    if (user.id) {
      requestPlaylistId(user.id);
    } else if (user.user) { // if in page url "/user/" request channel id
      var request = gapi.client.youtube.channels.list({
        forUsername: user.user,
        part: 'id'
      });

      request.execute(function(response) {
          requestPlaylistId(response.items[0].id);
        });
    }
  }

  function requestPlaylistId(channelId) {
    appendSimonov(true);
    var request = gapi.client.youtube.channels.list({
      id: channelId,
      part: 'contentDetails'
    });

    request.execute(function(response) {
        requestVideos(response.items[0].contentDetails.relatedPlaylists.uploads);
      });
  }

  // requesting videos from channel
  // channelId -
  function requestVideos(plId, responseObj) {
    var q = {
      playlistId: plId,
      maxResults: PER_PAGE,
      fields: 'items/snippet/title,items/snippet/resourceId/videoId,nextPageToken,pageInfo',
      part: 'snippet'
    };
    q.pageToken = (responseObj !== undefined && responseObj.nextPageToken !== undefined) ? responseObj.nextPageToken : null;
    var request = gapi.client.youtube.playlistItems.list(q);

    request.execute(function(response) {
      progress.max = response.pageInfo.totalResults;
      proceedDislikes(plId, response);
    });
  }

  function proceedDislikes(channelId, responseObj) {
    var singleDislikeCallback = function(i) {
      if (responseObj.nextPageToken === undefined &&
         (responseObj.items.length - 1) === i) {
        appendSimonov(false);
      }
    };

    for (var i = 0; i < responseObj.items.length; i++) {
      var q = {
        id: responseObj.items[i].snippet.resourceId.videoId,
        rating: 'dislike'
      };

      proceedSingleDislike(q, i, singleDislikeCallback);
    }

    if (responseObj !== undefined && responseObj.nextPageToken !== undefined) {
      // should start all pages at same time, but actually starts in queue
      setTimeout(function() {
        requestVideos(channelId, responseObj);
      }, DELAY_TIME * PER_PAGE);
    }
  }

  function proceedSingleDislike(query, delay, callback) {
    setTimeout(function(callback) {
      var request = gapi.client.youtube.videos.rate(query);
      request.execute(function() {
        return true;
      });
      progress.increase();
      if (typeof callback === 'function') {
        callback.call(this, delay);
      }
    }, DELAY_TIME * delay, callback);
  }
});
