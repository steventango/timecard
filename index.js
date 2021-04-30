// Client ID and API key from the Developer Console
const CLIENT_ID = '818544111364-5ffmploj9m0r536h5612m8mghtik3s88.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDhZHHxPKc8K40yd4f296Jc8PCsNMvSRaM';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly';

const authorize_button = document.getElementById('authorize_button');
const signout_button = document.getElementById('signout_button');
const picker_button = document.getElementById('picker_button');
picker_button.addEventListener('click', createPicker);
const update_token_button = document.getElementById('update_token_button');
update_token_button.addEventListener('click', updateToken);

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
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorize_button.onclick = handleAuthClick;
    signout_button.onclick = handleSignoutClick;
  }, function (error) {
    [authorize_button, signout_button, picker_button, update_token_button]
      .forEach(button => button.style.display = 'none');
    console.error(JSON.stringify(error, null, 2));
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorize_button.style.display = 'none';
    signout_button.style.display = 'inline-block';
  } else {
    authorize_button.style.display = 'inline-block';
    signout_button.style.display = 'none';
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

let DOC;

async function pickerCallback(data) {
  if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
    DOC = data[google.picker.Response.DOCUMENTS][0];
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

let data;
let NAME;
let TOTAL = 0;

const dropArea = document.getElementById('drop_area');

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
  const fileList = this.files || files;
  const file = fileList[0];
  NAME = file.name.slice(0, -4);
  const reader = new FileReader();
  reader.onload = () => {
    data = reader.result;
    data = JSON.parse(data.slice(4));
    sumtime();
    plot();
  };
  reader.readAsText(file);
}

let editors;

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

  TOTAL = 0;
  for (var key in editors) {
    var editor = editors[key];
    editor.interactions.push({
      first: editor.first,
      sum: editor.sum
    });
    editor.total += editor.sum;
    TOTAL += editor.total;
    delete editor.delta;
    delete editor.first;
    delete editor.sum;
    delete editor.last;
    editor.user = data.userMap[key];
  }
  let sorted = {};
  Object.keys(editors)
    .sort((a, b) => editors[b].user.name.localeCompare(editors[a].user.name))
    .forEach((key) => {
      sorted[key] = editors[key];
    });

  editors = sorted;
}

function plot() {
  let plotdata = [];
  for (let editor of Object.values(editors)) {
    editor.offset = 0;
    for (let i = 0; i < editor.interactions.length; i++) {
      let interaction = editor.interactions[i];
      let object = {
        x: [],
        y: [],
        sum: [],
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

  let traces = [];
  console.log(plotdata);
  for (let i = 0; i < plotdata.length; ++i) {
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
      hoverinfo: 'none',
      type: 'bar'
    });
  }

  let layout = {
    title: `${(DOC ? DOC.name : NAME)}<br><sub>${moment(TOTAL).utc().format('H:mm:ss')}</sub>`,
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
