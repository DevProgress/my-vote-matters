// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.

  const MIN_WIDTH = 300;
  const MIN_WIDTH_RATIO = 0.5;
  var MARGIN = 30;
  var TEXT_HEIGHT = 40;
  var TEXT_PADDING = 10;
  var HORIZ_INC = 2*MARGIN;
  var VERT_INC = 2*MARGIN + TEXT_HEIGHT;
  const RED = "#ff3333";
  const BLUE = "#0066cc";

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

  function startup() {
    video = document.getElementById('video');
    wrapper = document.getElementById('video-wrapper');
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    photo = document.getElementById('photo');
    startbutton = document.getElementById('startbutton');

    navigator.getMedia = ( navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia);

    navigator.getMedia(
      {
        video: true,
        audio: false
      },
      function(stream) {
        if (navigator.mozGetUserMedia) {
          video.mozSrcObject = stream;
        } else {
          var vendorURL = window.URL || window.webkitURL;
          video.src = vendorURL.createObjectURL(stream);
        }
        video.play();
      },
      function(err) {
        console.log("An error occured! " + err);
      }
    );

    resizeCanvas();
    video.addEventListener('canplay', function(ev){
      (function loop() {
        addTextToImage();
        setTimeout(loop, 1000 / 60);
      })();
      resizeCanvas();
      video.play();
    }, false);

    startbutton.addEventListener('click', function(ev){
      takepicture();
      ev.preventDefault();
    }, false);

    canvas.addEventListener('click', function(ev){
      takepicture();
    }, false);

    // Event listeners

    function addClickEventListener(selector, callback) {
      document.querySelector(selector).addEventListener('click', callback);
    }

    addClickEventListener('.cancel-button', untakepicture);

    addClickEventListener('.twitter-share-button', postToTwitter);

    addClickEventListener('.fb-share-button', postToFacebook);

    window.addEventListener('orientationchange', function(ev) {
      setTimeout(resizeCanvas, 300); // FIXME can this be lower?
    });

    window.addEventListener('resize', resizeCanvas);

    // Initialize OAuth
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "WDBN6HtSl2OSBHDCMdhaT_tMBRE";
    OAuth.initialize(OAuthKey);
  }

  function resizeCanvas() {
    width = Math.min(MIN_WIDTH, Math.round(screen.width * MIN_WIDTH_RATIO));
    MARGIN = width / 15;
    INSIDE_MARGIN = width / 20;
    TEXT_HEIGHT = 2 * MARGIN;
    TEXT_PADDING = TEXT_HEIGHT / 4;
    HORIZ_INC = 1.5*MARGIN;
    VERT_INC = 1.5*MARGIN + TEXT_HEIGHT + 2*TEXT_PADDING;
    height = video.videoHeight / (video.videoWidth/width);

    // Firefox currently has a bug where the height can't be read from
    // the video, so we will make assumptions if this happens.

    if (isNaN(height)) {
      height = width / (4/3);
    }

    canvas.setAttribute('width', width + HORIZ_INC);
    canvas.setAttribute('height', height + VERT_INC);
    canvas.style.top = MARGIN + "px";
    wrapper.style.width = (width + 4*MARGIN) + "px";
    wrapper.style.height = (height + 4*MARGIN + TEXT_HEIGHT + 2*TEXT_PADDING) + "px";
    $("input").css("width", width + 4*MARGIN);

    // adjust carousel font size
    $('#carousel').carousel(0);
    font_size('longest', '#carousel');
    $('.carousel-control').css('font-size', document.getElementById('carousel').clientHeight/1.5 + "px");
    $('#header').css('font-size', document.getElementById('header').clientHeight/5 + "px");
    font_size('devprogress-footer', '#devprogress-footer');
  }

  function font_size(id, sel) {
    var elem = document.getElementById(id);
    sel = $(sel);
    var size = sel.css('font-size');
    while (elem.scrollHeight <= elem.clientHeight) {
      size = parseInt(sel.css('font-size')) + 1;
      sel.css('font-size', size + "px");
    }
    while (elem.scrollHeight > elem.clientHeight) {
      size = parseInt(sel.css('font-size')) - 1;
      sel.css('font-size', size + "px");
    }
    return size;
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
    context.fillText("#MyVoteMatters because", canvas.width/2, canvas.height - INSIDE_MARGIN - TEXT_HEIGHT + TEXT_PADDING);
    context.fillStyle = "black";
  }

  function takepicture() {
    video.pause();

    el('#streaming').classList.add('no-display');
    el('#share-photo').classList.remove('no-display');
  }

  function untakepicture() {
    video.play();

    el('#streaming').classList.remove('no-display');
    el('#share-photo').classList.add('no-display');
  }

  function getImageData() {
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/png');
    var file = dataURItoBlob(data);
    return file;
  }

  function getMessage() {
    var message = el(".input-message").value;
    return message;
  }

  function postToTwitter() {
    var file = getImageData();
    var message = getMessage();
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
      onShareSuccess("http://" + url);
    }).fail(function(e){
      onShareError(e);
    });
  }

  function postToFacebook() {
    var file = getImageData();
    var message = getMessage();
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
      onShareSuccess(url);
    }).fail(function(e){
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
    el("#share-photo").classList.add("no-display");
    el(".result").classList.remove("no-display");
    el(".result").innerHTML = "Success! View your post here: <a target=\"_blank\" href=\"" + url + "\">" + url +"</a>";
  }

  function onShareError(err) {
    console.log(err);
    // Hide the share buttons,
    // show the result field
    el("#share-photo").classList.add("no-display");
    el(".result").classList.remove("no-display");
    el(".result").innerHTML = "Sorry, something went wrong.";
  }

  function addTextToImage() {
    polaroid(canvas, context);
    context.drawImage(video, INSIDE_MARGIN, INSIDE_MARGIN, width, height);

    var message = getMessage();
    context.font = (TEXT_HEIGHT/2) + "px Montserrat";
    context.textAlign = "center";
    context.fillText(message, canvas.width/2, canvas.height - TEXT_PADDING*1.5);
  }

  function el(selector) {
    return document.querySelector(selector);
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
