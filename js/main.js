// http://mdn-samples.mozilla.org/s/webrtc-capturestill/

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.

  var width = 396;    // We will scale the photo width to this
  var height = 0;     // This will be computed based on the input stream

  // |streaming| indicates whether or not we're currently streaming
  // video from the camera. Obviously, we start at false.

  var streaming = false;

  // The various HTML elements we need to configure or control. These
  // will be set by the startup() function.

  var video = null;
  var canvas = null;
  var photo = null;
  var startbutton = null;

  function startup() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
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

        video.setAttribute('width', width);
        video.setAttribute('height', height);
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        streaming = true;
      }
    }, false);

    startbutton.addEventListener('click', function(ev){
      takepicture();
      ev.preventDefault();
    }, false);
    
    clearphoto();

    // Event listeners

    $('.overlay').on('click', '.close-overlay', function(ev) {
      $(ev.delegateTarget).addClass('hidden');
    });

    $('.overlay').on('click', '.text-button', function(ev) {
      addTextToImage();
    });

    $('.overlay').on('click', '.twitter-share-button', function(ev) {
      postToTwitter();
    });

    $('.overlay').on('click', '.fb-share-button', function(ev) {
      postToFacebook();
    });

    // Initialize OAuth
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "WDBN6HtSl2OSBHDCMdhaT_tMBRE";
    OAuth.initialize(OAuthKey);
  }

  // Fill the photo with an indication that none has been
  // captured.

  function clearphoto() {
    var context = canvas.getContext('2d');
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, canvas.width, canvas.height);

    var data = canvas.toDataURL('image/png');
    photo.setAttribute('src', data);
  }
  
  // Capture a photo by fetching the current contents of the video
  // and drawing it into a canvas, then converting that to a PNG
  // format data URL. By drawing it on an offscreen canvas and then
  // drawing that to the screen, we can change its size and/or apply
  // other changes before drawing it.

  function takepicture() {
    clearPopupState();

    var context = canvas.getContext('2d');
    if (width && height) {
      canvas.width = 454; // size of polaroid
      canvas.height = 404;

      // first draw polaroid
      var image = document.getElementById("frame");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // then draw picture (with proper offset)
      context.drawImage(video, 29, 30, width, height);

      // show popup
      var data = canvas.toDataURL('image/png');
      photo.setAttribute('src', data);
      $('#photo-success').removeClass('hidden');
    } else {
      clearphoto();
    }
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

  function clearPopupState() {
    // Clear the message input field
    $(".input-message").val("");
    // Show the text button
    $(".text-button-wrapper").removeClass("no-display");
    // Hide the result
    $(".result").addClass("no-display");
    // hide the share buttons
    $(".share-button-wrapper").addClass("no-display");
  }

  function onShareSuccess(url) {
    // Hide the share buttons,
    // show the result field
    $(".share-button-wrapper").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result").html("Success! View your post here: <a target=\"_blank\" href=\"" + url + "\">" + url +"</a>");
  }

  function onShareError() {
    // Hide the share buttons,
    // show the result field
    $(".share-button-wrapper").addClass("no-display");
    $(".result").removeClass("no-display");
    $(".result").html("Sorry, something went wrong.");
  }

  function addTextToImage() {
    var context = canvas.getContext('2d');
    var message = getMessage();
    context.font = "20px Coming Soon";
    context.textAlign = "center";
    context.fillText(message, canvas.width/2, 385);
    var data = canvas.toDataURL('image/png');
    photo.setAttribute('src', data);

    $(".input-message").val("#myvotematters because " + message);
    $(".text-button-wrapper").addClass("no-display");
    $(".share-button-wrapper").removeClass("no-display");
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
