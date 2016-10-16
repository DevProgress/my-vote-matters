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

    $('.overlay').on('click', '.close-overlay', function(ev) {
      $(ev.delegateTarget).addClass('hidden');
    });

    $('.overlay').on('click', '.twitter-share', function(ev) {
      postToTwitter();
    });

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
    var context = canvas.getContext('2d');
    if (width && height) {
      canvas.width = 454; // size of polaroid
      canvas.height = 404;

      // first draw polaroid
      var image = document.getElementById("frame");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // then draw picture (with proper offset)
      context.drawImage(video, 29, 30, width, height);

      var data = canvas.toDataURL('image/png');
      photo.setAttribute('src', data);

      // show popup
      $('#photo-success').removeClass('hidden');
    } else {
      clearphoto();
    }
  }

  function postToTwitter() {
    // http://blog.devteaminc.co/posting-a-canvas-image-to-twitter-using-oauth/
    var OAuthKey = "";
    OAuth.initialize(OAuthKey);

    // Convert Base64 image to binary
    var canvas = document.getElementById('canvas');
    var data = canvas.toDataURL('image/png');
    var file = dataURItoBlob(data);

    // Open a tweet popup and autopopulate with data
    OAuth.popup("twitter").then(function(result) {
      var data = new FormData();
      // Tweet text
      data.append('status', "#myvotematters");
      // Binary image
      data.append('media[]', file, 'pic.png');
      // Post to Twitter as an update with media
      return result.post('/1.1/statuses/update_with_media.json', {
        data: data,
        cache: false,
        processData: false,
        contentType: false
      });
      // Success/Error Logging
    }).done(function(data){
      var url = data.entities.media[0].display_url;
      $(".twitter-share").addClass("noDisplay");
      $("#result").removeClass("noDisplay");
      $("#result").html("Success! View your tweet here: <a href=\"http://" + url +"\">" + url +"</a>");
    }).fail(function(e){
      $(".twitter-share").addClass("noDisplay");
      $("#result").removeClass("noDisplay");
      $("#result").html("Sorry, something went wrong.");
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

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
