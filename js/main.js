// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.
  
  const MIN_WIDTH = 300;
  const MIN_WIDTH_RATIO = 0.5;
  var MARGIN = 30;
  const BORDER = 3;
  var TEXT_HEIGHT = 40;
  var HORIZ_INC = 2*MARGIN + BORDER;
  var VERT_INC = 2*MARGIN + TEXT_HEIGHT + BORDER;
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
    }, false);

    startbutton.addEventListener('click', function(ev){
      takepicture();
      ev.preventDefault();
    }, false);

    canvas.addEventListener('click', function(ev){
      takepicture();
    }, false);
    
    // Event listeners

    $('#controls').on('click', '.cancel-button', function(ev) {
      untakepicture();
    });

    $('#controls').on('click', '.twitter-share-button', function(ev) {
      postToTwitter();
    });

    $('#controls').on('click', '.fb-share-button', function(ev) {
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

  function resizeCanvas() {
    width = Math.min(MIN_WIDTH, Math.round(screen.width * MIN_WIDTH_RATIO));
    MARGIN = width / 10;
    TEXT_HEIGHT = 4/3 * MARGIN;
    HORIZ_INC = 2*MARGIN + BORDER;
    VERT_INC = 2*MARGIN + TEXT_HEIGHT + BORDER;
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
    wrapper.style.height = (height + 5*MARGIN) + "px";


    // adjust carousel font size
    $('#carousel').carousel(0);
    var longest = document.getElementById('longest');
    while (longest.scrollHeight <= longest.clientHeight) {
      $('#carousel').css('font-size', (parseInt($('#carousel').css('font-size')) + 1) + "px");
    }
    while (longest.scrollHeight > longest.clientHeight) {
      $('#carousel').css('font-size', (parseInt($('#carousel').css('font-size')) - 1) + "px");
    }
    $('.carousel-control').css('font-size', document.getElementById('carousel').clientHeight/1.5 + "px");
    $('#header').css('font-size', document.getElementById('header').clientHeight/5 + "px");
  }

  // Capture a photo by fetching the current contents of the video
  // and drawing it into a canvas, then converting that to a PNG
  // format data URL. By drawing it on an offscreen canvas and then
  // drawing that to the screen, we can change its size and/or apply
  // other changes before drawing it.
  
  function polaroid(canvas, context) {
    context.beginPath();
    context.lineWidth = "" + BORDER;
    context.strokeStyle = "black";
    context.fillStyle = "white";
    context.rect(BORDER, BORDER, width + TEXT_HEIGHT + BORDER*4, height + TEXT_HEIGHT*2 + BORDER - 1);
    context.fill();
    context.stroke();
    context.fillStyle = "black";
    context.beginPath();
    context.lineWidth = "" + BORDER;
    context.strokeStyle = "black";
    context.rect(MARGIN + 1, MARGIN + 1, width + BORDER - 1, height + BORDER);
    context.stroke();
    context.fillStyle = BLUE;
    context.textAlign = "center";
    context.font = (TEXT_HEIGHT/2) + "px Montserrat";
    context.fillText("#MyVoteMatters because", canvas.width/2, canvas.height - MARGIN - TEXT_HEIGHT/2 + 1);
    context.fillStyle = "black";
  }

  function takepicture() {
    video.pause();

    $('#streaming').addClass('no-display');
    $('#share-photo').removeClass('no-display');
  }

  function untakepicture() {
    video.play();

    $('#streaming').removeClass('no-display');
    $('#share-photo').addClass('no-display');
  }

  function getImageData() {
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/png');
    var file = dataURItoBlob(data);
    return file;
  }

  function getMessage() {
    var message = $(".input-message").val();
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
    $("#share-photo").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result").html("Success! View your post here: <a target=\"_blank\" href=\"" + url + "\">" + url +"</a>");
  }

  function onShareError(err) {
    console.log(err);
    // Hide the share buttons,
    // show the result field
    $("#share-photo").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result").html("Sorry, something went wrong.");
  }

  function addTextToImage() {
    polaroid(canvas, context);
    context.drawImage(video, BORDER + MARGIN - 1, BORDER + MARGIN, width, height);

    var message = getMessage();
    context.font = (TEXT_HEIGHT/2) + "px Coming Soon";
    context.textAlign = "center";
    context.fillText(message, canvas.width/2, canvas.height - MARGIN + BORDER/2);
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
