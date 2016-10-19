// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.
  
  const MIN_WIDTH = 396;
  const MIN_WIDTH_RATIO = 0.6;
  const MARGIN = 30;
  const BORDER = 3;
  const TEXT_HEIGHT = 40;
  const HORIZ_INC = 2*MARGIN + BORDER;
  const VERT_INC = 2*MARGIN + TEXT_HEIGHT + BORDER;

  var width = Math.min(MIN_WIDTH, Math.round(screen.width * MIN_WIDTH_RATIO));    // We will scale the photo width to this
  var height = 0;     // This will be computed based on the input stream

  // |streaming| indicates whether or not we're currently streaming
  // video from the camera. Obviously, we start at false.

  var streaming = false;

  // The various HTML elements we need to configure or control. These
  // will be set by the startup() function.

  var video = null;
  var photo = null;
  var startbutton = null;

  function startup() {
    video = document.getElementById('video');
    canvas = document.getElementById("canvas");
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

    video.addEventListener('canplay', function(ev){
      if (!streaming) {
        height = video.videoHeight / (video.videoWidth/width);

        // Firefox currently has a bug where the height can't be read from
        // the video, so we will make assumptions if this happens.

        if (isNaN(height)) {
          height = width / (4/3);
        }

        canvas.setAttribute('width', width + HORIZ_INC);
        canvas.setAttribute('height', height + VERT_INC);
        document.getElementById('video-wrapper').style.height = (height + VERT_INC) + "px";

        var ctx = canvas.getContext('2d');
        polaroid(canvas, ctx);
        (function loop() {
          if (streaming) {
            ctx.drawImage(video, MARGIN - 1, MARGIN, width, height);
          }
          addTextToImage();
          setTimeout(loop, 1000 / 60);
        })();

        streaming = true;
      }
    }, false);

    startbutton.addEventListener('click', function(ev){
      takepicture();
      ev.preventDefault();
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

    // Initialize OAuth
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "WDBN6HtSl2OSBHDCMdhaT_tMBRE";
    OAuth.initialize(OAuthKey);
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
    context.rect(BORDER, BORDER, width + TEXT_HEIGHT + BORDER*4, height + TEXT_HEIGHT*2 + BORDER - 1);
    context.stroke();
    context.beginPath();
    context.lineWidth = "" + BORDER;
    context.strokeStyle = "black";
    context.rect(MARGIN - BORDER + 1, MARGIN - BORDER + 1, width + BORDER - 1, height + BORDER);
    context.stroke();
    context.textAlign = "center";
    context.font = "bold 14pt Helvetica";
    context.fillText("#MyVoteMatters because", canvas.width/2, canvas.height - 53);
  }

  function takepicture() {
    streaming = false;

    $('#streaming').addClass('no-display');
    $('#share-photo').removeClass('no-display');
  }

  function untakepicture() {
    canvas.getContext('2d').clearRect(BORDER*2, MARGIN + BORDER + height + BORDER + TEXT_HEIGHT/2, width + TEXT_HEIGHT + BORDER*2, TEXT_HEIGHT/2 + BORDER);
    streaming = true;

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
      onShareError();
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
      onShareError();
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

  function onShareError() {
    // Hide the share buttons,
    // show the result field
    $("#share-photo").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result").html("Sorry, something went wrong.");
  }

  function addTextToImage() {
    var context = canvas.getContext('2d');
    var message = getMessage();
    context.font = "20px Coming Soon";
    context.textAlign = "center";
    canvas.getContext('2d').clearRect(BORDER*2, MARGIN + BORDER + height + BORDER + TEXT_HEIGHT/2, width + TEXT_HEIGHT + BORDER*2, TEXT_HEIGHT/2 + BORDER*2);
    context.fillText(message, canvas.width/2, canvas.height - 30);
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
