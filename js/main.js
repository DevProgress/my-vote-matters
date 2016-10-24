// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.
  const MESSAGE_PREFIX = "#MyVoteMatters because";
  const MESSAGE_SUFFIX = "(share yours at myvotematters.today)";
  const MIN_WIDTH = 300;
  const MIN_WIDTH_RATIO = 0.5;
  var MARGIN = 30;
  var TEXT_HEIGHT = 40;
  var TEXT_PADDING = 10;
  var HORIZ_INC = 2*MARGIN;
  var VERT_INC = 2*MARGIN + TEXT_HEIGHT;
  const RED = "#ff3333";
  const BLUE = "#0066cc";

  var CAMERA_STARTED = false;

  var width = 0;    // We will scale the photo width to this
  var height = 0;     // This will be computed based on the input stream

  // The various HTML elements we need to configure or control. These
  // will be set by the startup() function.

  var video = null;
  var wrapper = null;
  var canvas = null;
  var context = null;
  var photo = null;
  var startbutton = null;
  var camerabutton = null;

  function startCamera() {
    $("#camerabutton").addClass("no-display");
    $("#streaming").removeClass("no-display");

    connectCamera().then(function() {
      video.addEventListener('canplay', function(ev){
        (function loop() {
          addTextToImage();
          setTimeout(loop, 1000 / 60);
        })();
        resizeCanvas();
        video.play();
      }, false);
      video.play();
    }, createNoCameraUI);
  }

  function connectCamera() {
    // FIXME: Replace with MediaDevices.getUserMedia.
    var getUserMedia =  (navigator.getUserMedia ||
                        navigator.webkitGetUserMedia ||
                        navigator.mozGetUserMedia ||
                        navigator.msGetUserMedia);

    return new Promise(function(resolve, reject) {
      if (!getUserMedia) {
        reject();
        return;
      }

      CAMERA_STARTED = true;
      getUserMedia = getUserMedia.bind(navigator);

      getUserMedia({ video: true, audio: false },
        function(stream) {
          if (navigator.mozGetUserMedia) {
            video.mozSrcObject = stream;
          } else {
            var vendorURL = window.URL || window.webkitURL;
            video.src = vendorURL.createObjectURL(stream);
          }
          resolve();
        }, reject
      );
    });
  }

  function startup() {
    video = document.getElementById('video');
    wrapper = document.getElementById('video-wrapper');
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    photo = document.getElementById('photo');
    startbutton = document.getElementById('startbutton');
    camerabutton = document.getElementById('camerabutton');

    createBackgroundSelfies();

    // wait for Montserrat to be loaded
    // video wrapper is hidden at first to prevent weird flashing on page load
    // in theory document.fonts.ready works in FF and Chrome, but it doesn't, so use a hacky timeout instead
    setTimeout(function() {
      $("#video-wrapper").removeClass("no-display");
      resizeCanvas();
    }, 100);

    // Event listeners

    camerabutton.addEventListener('click', function(ev){
      ga('send', 'event', 'camera', 'click');
      startCamera();
      ev.preventDefault();
    }, false);

    startbutton.addEventListener('click', function(ev){
      ga('send', 'event', 'start', 'click');
      takepicture();
      ev.preventDefault();
    }, false);

    canvas.addEventListener('click', function(ev){
      ga('send', 'event', 'start', 'click');
      takepicture();
    }, false);

    $('#controls').on('click', '.cancel-button', function(ev) {
      ga('send', 'event', 'cancel', 'click');
      untakepicture();
    });

    $('#controls').on('click', '.twitter-share-button', function(ev) {
      ga('send', 'event', 'share', 'click', 'twitter');
      postToTwitter();
    });

    $('#controls').on('click', '.fb-share-button', function(ev) {
      ga('send', 'event', 'share', 'click', 'facebook');
      postToFacebook();
    });

    $(window).on('orientationchange', function(ev) {
      setTimeout(resizeCanvas, 300); // FIXME can this be lower?
    });

    $(window).on('resize', function(ev) {
      resizeCanvas();
    });

    // Initialize OAuth
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "WDBN6HtSl2OSBHDCMdhaT_tMBRE";
    OAuth.initialize(OAuthKey);
  }

  function drawPlaceholder() {
    context.beginPath();
    context.fillStyle = "white";
    context.rect(0, 0, width + 2*INSIDE_MARGIN, height + 2*INSIDE_MARGIN + 20*TEXT_HEIGHT + 2*TEXT_PADDING);
    context.fill();

    context.fillStyle = BLUE;
    context.textAlign = "center";
    context.font = (TEXT_HEIGHT/2) + "px Montserrat, Helvetica Neue, Helvetica, Arial, sans-serif";
    context.fillText("Share why YOUR vote matters", canvas.width/2, canvas.height - INSIDE_MARGIN - TEXT_HEIGHT + TEXT_PADDING*2);
    context.fillStyle = "black";

    context.beginPath();
    context.fillStyle = RED;
    context.rect(INSIDE_MARGIN, INSIDE_MARGIN, width, height);
    context.fill();
  }

  function resizeCanvas() {
    width = Math.min(MIN_WIDTH, Math.round(screen.width * MIN_WIDTH_RATIO));
    MARGIN = width / 15; // of blue wrapper
    INSIDE_MARGIN = width / 20; // of white polaroid
    TEXT_HEIGHT = 2 * MARGIN;
    TEXT_PADDING = TEXT_HEIGHT / 4;
    HORIZ_INC = 2*INSIDE_MARGIN;
    VERT_INC = 2*INSIDE_MARGIN + TEXT_HEIGHT + 2*TEXT_PADDING;
    height = video.videoHeight / (video.videoWidth/width);

    // Firefox currently has a bug where the height can't be read from
    // the video, so we will make assumptions if this happens.

    if (isNaN(height)) {
      height = width / (4/3);
    }

    canvas.setAttribute('width', width + HORIZ_INC);
    canvas.setAttribute('height', height + VERT_INC);
    canvas.style.top = MARGIN + "px";
    wrapper.style.width = (width + HORIZ_INC + 2*MARGIN) + "px";
    wrapper.style.height = (height + VERT_INC + 2*MARGIN) + "px";
    $("input").css("width", width + HORIZ_INC + 2*MARGIN);

    if (!CAMERA_STARTED) {
      drawPlaceholder();
    }
  }

  function createNoCameraUI() {
    ga('send', 'event', 'no-camera', 'error');

    // Show an error message explaining that you
    // need to upload a photo instead
    $("#canvas").addClass("no-display");
    wrapper.classList.add('camera-failure');
    wrapper.classList.add('fgwhite');
    var textNode = document.createTextNode('Oops! It looks like your camera won\'t work here, but you can upload a photo instead by pressing the button below.');
    wrapper.appendChild(textNode);

    var controls = document.querySelector('#controls');
    var upload = document.createElement('input');
    upload.type ='file';
    upload.style.display = 'none';
    upload.setAttribute('capture', 'camera');
    upload.setAttribute('accept', 'image/*');
    document.querySelector('#streaming .text').textContent = 'Upload photo';
    // FIXME: This is a dirty hack, making an Image quack like a <video> element.
    // Namely, the takepicture() function calls video.pause(),
    // which calls upload.click()
    video = document.createElement('img');
    video.play = function() {};
    video.pause = function() {
      upload.click();
    };

    upload.addEventListener('change', function(event) {
      // on upload click we should ...
      // 1) get rid of the error message
      // 2) Show the canvas again
      wrapper.classList.remove('camera-failure');
      try { // might have already removed this node
        wrapper.removeChild(textNode);
      } catch (err) {
      }
      $("#canvas").removeClass("no-display");

      video.src = URL.createObjectURL(event.target.files[0]);
      (function loop() {
        addTextToImage();
        setTimeout(loop, 1000 / 60);
      })();
      resizeCanvas();
    });

    controls.appendChild(upload);
  }

  // Capture a photo by fetching the current contents of the video
  // and drawing it into a canvas, then converting that to a PNG
  // format data URL. By drawing it on an offscreen canvas and then
  // drawing that to the screen, we can change its size and/or apply
  // other changes before drawing it.

  function polaroid(canvas, context) {
    context.beginPath();
    context.fillStyle = "white";
    context.rect(0, 0, width + 2*INSIDE_MARGIN, height + 2*INSIDE_MARGIN + 20*TEXT_HEIGHT + 2*TEXT_PADDING);
    context.fill();

    context.fillStyle = BLUE;
    context.textAlign = "center";
    context.font = (TEXT_HEIGHT/2) + "px Montserrat";
    context.fillText(MESSAGE_PREFIX, canvas.width/2, canvas.height - INSIDE_MARGIN - TEXT_HEIGHT + TEXT_PADDING);
    context.fillStyle = "black";
  }

  function takepicture() {
    video.pause();
    $('#streaming').addClass('no-display');
    $(".input-wrapper").removeClass("no-display");
    $('#share-photo').removeClass('no-display');
  }

  function untakepicture() {
    clearMessage();
    video.play();

    $('#streaming').removeClass('no-display');
    $('#share-photo').addClass('no-display');
    $('.result').addClass('no-display');
  }

  function getImageData() {
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/png');
    var file = dataURItoBlob(data);
    return file;
  }

  function getMessage(fix) {
    var message = $(".input-message").val();
    if (fix) {
      message = MESSAGE_PREFIX + " " + message + " " + MESSAGE_SUFFIX;
    }
    return message;
  }

  function clearMessage() {
    $(".input-message").val("");
  }

  function postToTwitter() {
    var file = getImageData();
    var message = getMessage(true);
    OAuth.popup("twitter").then(function(result) {
      var data = new FormData();
      data.append('status', message);
      data.append('media[]', file, 'pic.png');
      return result.post('/1.1/statuses/update_with_media.json', {
        data: data,
        cache: false,
        processData: false,
        contentType: false
      });
    }).done(function(data){
      var url = data.entities.media[0].display_url;
      ga('send', 'event', 'share', 'success', 'twitter');
      onShareSuccess("http://" + url);
    }).fail(function(e){
      ga('send', 'event', 'share', 'error', 'twitter');
      onShareError(e);
    });
  }

  function postToFacebook() {
    var file = getImageData();
    var message = getMessage(true);
    OAuth.popup("facebook").then(function(result) {
      var data = new FormData();
      data.append('caption', message);
      data.append('source', file);
      return result.post('/me/photos', {
        data: data,
        cache: false,
        processData: false,
        contentType: false
      });
    }).done(function(data){
      var url = "https://www.facebook.com/photo.php?fbid=" + data.id;
      ga('send', 'event', 'share', 'success', 'facebook');
      onShareSuccess(url);
    }).fail(function(e){
      ga('send', 'event', 'share', 'error', 'facebook');
      onShareError(e);
    });
  }

  function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
      byteString = atob(dataURI.split(',')[1]);
    else
      byteString = unescape(dataURI.split(',')[1]);
    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ia], {type:mimeString});
  }

  function onShareSuccess(url) {
    // Hide the share buttons,
    // show the result field
    $("#share-photo").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result-text").html("Success! View your post <a target=\"_blank\" href=\"" + url + "\">here.</a>");
  }

  function onShareError(err) {
    console.log(err);
    // Hide the share buttons,
    // show the result field
    $("#share-photo").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result-text").html("Sorry, something went wrong.");
  }

  function addTextToImage() {
    polaroid(canvas, context);
    context.drawImage(video, INSIDE_MARGIN, INSIDE_MARGIN, width, height);

    var message = getMessage();

    // limit to the length that will fit in a tweet
    var len = MESSAGE_PREFIX.length + MESSAGE_SUFFIX.length + 2;
    message = message.substr(0, len);

    // autosize font while word-wrapping
    context.textAlign = "center";
    var div = 2;
    context.font = (TEXT_HEIGHT/div) + "px Montserrat";
    var lines = getLines(context, message, width);
    while (!textFits(context, lines, div - 1, width)) {
      div++;
      context.font = (TEXT_HEIGHT/div) + "px Montserrat";
      lines = getLines(context, message, width);
    }

    for (var i = 0; i < lines.length; i++) {
      var ypos = canvas.height - TEXT_PADDING*1.5;
      if (lines.length > 1) {
        ypos += (i - lines.length/2) * (TEXT_HEIGHT/(lines.length * div) + TEXT_PADDING/(div/2));
      }
      context.fillText(lines[i], canvas.width/2, ypos);
    }
  }

  function textFits(ctx, lines, maxLines, maxWidth) {
    if (lines.length > maxLines) return false;
    
    for (var i = 0; i < lines.length; i++) {
      if (ctx.measureText(lines[i]) > maxWidth) {
        return false;
      }
    }

    return true;
  }

  function getLines(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  }

  function createBackgroundSelfies() {
    const SELFIE_COUNT = 14;
    const SELFIE_COL_COUNT = 4;
    const SELFIE_ROW_COUNT = 2;

    photoIndices = createArrayFromKnuthShuffle();
    var root = document.querySelector('#photos>div');
    photoIndices.slice(0, SELFIE_ROW_COUNT * SELFIE_COL_COUNT).forEach(function(index) {
      var img = document.createElement('img');
      img.src = 'img/photo-' + index + '.png';
      root.appendChild(img);
    });

    function createArrayFromKnuthShuffle() {
      var array = Array.apply(null, Array(SELFIE_COUNT));
      array = array.map(function(_, i) { return i + 1; })
      var currentIndex = SELFIE_COUNT;
      var temp;
      var randomIndex;
      while (currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temp;
      }
      return array;
    }

  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('DOMContentLoaded', startup, false);
})();
