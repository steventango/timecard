// Client ID and API key from the Developer Console
var CLIENT_ID = '818544111364-5ffmploj9m0r536h5612m8mghtik3s88.apps.googleusercontent.com';
var API_KEY = 'AIzaSyDhZHHxPKc8K40yd4f296Jc8PCsNMvSRaM';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
  gapi.load('picker', onPickerApiLoad);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  }, function (error) {
    ['authorize_button', 'signout_button', 'picker_button', 'update_token_button'].forEach(button => button.style.display = 'none');
    console.error(JSON.stringify(error, null, 2));
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'inline-block';
  } else {
    authorizeButton.style.display = 'inline-block';
    signoutButton.style.display = 'none';
  }
}

function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

function onPickerApiLoad() {
  pickerApiLoaded = true;
  createPicker();
}

function createPicker() {
  if (pickerApiLoaded && gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token) {
    var picker = new google.picker.PickerBuilder()
      .addViewGroup(
        new google.picker.ViewGroup(google.picker.ViewId.DOCS).
          addView(google.picker.ViewId.SPREADSHEETS).
          addView(google.picker.ViewId.DOCUMENTS).
          addView(google.picker.ViewId.FOLDERS).
          addView(google.picker.ViewId.PRESENTATIONS))
      .setOAuthToken(gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token)
      .setDeveloperKey(API_KEY)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  }
}

document.getElementById('picker_button').addEventListener('click', createPicker);

var DOC;

async function pickerCallback(data) {
  if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
    DOC = data[google.picker.Response.DOCUMENTS][0];
    console.log(DOC);
    var url = await generate_url(DOC);
    download(url);
  }
}

function download(uri) {
  var link = document.createElement("a");
  link.download = DOC.name;
  link.href = uri;
  link.click();
}

async function generate_url(doc) {
  var TOKEN = Cookie.get('TOKEN');
  if (!TOKEN) {
    TOKEN = prompt('Token:');
    if (TOKEN.length < 1) {
      throw "No TOKEN";
    }
    Cookie.set('TOKEN', TOKEN, 30);
  }
  var url = doc.url.match(/(.+)edit.+/)[1];
  var file_id = doc.id;
  var response = await gapi.client.drive.revisions.list({
    fileId: doc.id
  });
  var revisions = response.result.revisions;
  var end = revisions[revisions.length - 1].id;
  url += `revisions/tiles?id=${file_id}&start=1&end=${end}&showDetailedRevisions=true&filterNamed=false&token=${TOKEN}&includes_info_params=true`;
  return url;
}

function updateToken() {
  TOKEN = prompt('Token?');
  while (TOKEN.length < 1) {
    TOKEN = prompt('Token?');
  }
  Cookie.set('TOKEN', TOKEN, 10);
}

document.getElementById('update_token_button').addEventListener('click', updateToken);

var data;
var NAME;

var dropArea = document.getElementById('drop_area');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.add('mdc-ripple');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.remove('mdc-ripple');
  });
});

dropArea.addEventListener('drop', (e) => {
  let dt = e.dataTransfer;
  let files = dt.files;

  handleFiles(files);
});

const inputElement = document.getElementById("file");
inputElement.addEventListener("change", handleFiles, false);
function handleFiles(files) {
  const fileList = files || this.files;
  const file = fileList[0];
  NAME = file.name.slice(0, -4);
  const reader = new FileReader();
  reader.onload = () => {
    data = reader.result;
    data = JSON.parse(data.slice(4));
    console.log("File Read");
    sumtime();
    plot();
  };
  console.log("Reading File");
  reader.readAsText(file);
}

var editors;

function sumtime() {
  editors = {};
  var tiles = data.tileInfo;
  for (var i = 0; i < tiles.length; i++) {
    var tile = tiles[i];
    var current = tile.endMillis;
    for (var j = 0; j < tile.users.length; j++) {
      var editor = tile.users[j];
      if (!editors[editor]) {
        editors[editor] = {
          first: current,
          sum: 0,
          total: 0,
          last: current,
          delta: 0,
          interactions: []
        };
      }
      editors[editor].delta = current - editors[editor].last;
      if (editors[editor].delta > 15 * 60 * 1000) {
        editors[editor].interactions.push({
          first: editors[editor].first,
          sum: editors[editor].sum
        });
        editors[editor].total += editors[editor].sum;
        editors[editor].first = current;
        editors[editor].sum = 0;
      } else {
        editors[editor].sum += editors[editor].delta;
      }
      editors[editor].last = current;
    }
  }

  for (var key in editors) {
    var editor = editors[key];
    editor.interactions.push({
      first: editor.first,
      sum: editor.sum
    });
    editor.total += editor.sum;
    delete editor.delta;
    delete editor.first;
    delete editor.sum;
    delete editor.last;
    editor.user = data.userMap[key];
  }
  var sorted = {};
  Object.keys(editors).sort((a, b) => editors[b].user.name.localeCompare(editors[a].user.name)).forEach((key) => {
    sorted[key] = editors[key];
  });

  editors = sorted;
  console.log(editors);
}

function plot() {
  var plotdata = [];
  for (let editor of Object.values(editors)) {
    editor.offset = 0;
    for (var i = 0; i < editor.interactions.length; i++) {
      var interaction = editor.interactions[i];
      var object = {
        x: [],
        sum: [],
        y: [],
        color: []
      };
      if (!plotdata[i]) {
        plotdata[i] = object;
      }
      if (i > 0) {
        plotdata[i].x.push(moment(interaction.first).subtract(editor.offset, 'milliseconds').utc().format('YYYY-MM-DD H:mm:ss'));
      } else {
        plotdata[i].x.push(moment(interaction.first).format('YYYY-MM-DD H:mm:ss'));
      }
      plotdata[i].sum.push(moment(Math.max(1000, interaction.sum)).utc().format('YYYY-MM-DD H:mm:ss'));
      plotdata[i].y.push(`${editor.user.name} (${moment(editor.total).utc().format('H:mm:ss')})`);
      plotdata[i].color.push(editor.user.color);
      editor.offset = interaction.first + Math.max(1000, interaction.sum);
    }
    delete editor.offset;
  }

  var traces = [];

  for (var i = 0; i < plotdata.length; i++) {
    traces.push({
      x: plotdata[i].x,
      y: plotdata[i].y,
      showlegend: false,
      orientation: 'h',
      marker: { color: 'rgba(0,0,0,0)' },
      hoverinfo: 'none',
      name: 'null',
      type: 'bar'
    });
    traces.push({
      x: plotdata[i].sum,
      y: plotdata[i].y,
      orientation: 'h',
      marker: { color: plotdata[i].color },
      showlegend: false,
      hoverinfo: 'none',//plotdata[i].sum.map(values => moment(values).format('H:mm:ss')),
      type: 'bar'
    });
  }

  var layout = {
    title: DOC ? DOC.name : NAME,
    barmode: 'stack',
    xaxis: {
      showgrid: true,
      type: 'date'
    },
    margin: {
      l: 200
    }
  };

  var config = {
    displaylogo: false,
    responsive: true
  };

  console.log(traces);

  Plotly.newPlot('plot', traces, layout, config);
}