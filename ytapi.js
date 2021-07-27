const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const router = require("express").Router();

// If modifying these scopes, delete the previously saved credentials
// at __dirname/.credentials
// scopes are set to youtube.readonly, youtube.upload
const SCOPES = process.env.YTAPI_MAIN_SCOPES.split(" ");

const TOKEN_DIR = path.join(__dirname, process.env.YTAPI_TOKEN_DIR);
const TOKEN_PATH = path.join(TOKEN_DIR, process.env.YTAPI_TOKEN_FILE);

const REDIRECTURLS = process.env.YTAPI_GOOGLE_REDIRECT_URL.split(" ");

const OAUTH2CLIENT = new OAuth2(
  process.env.YTAPI_GOOGLE_CLIENT_ID,
  process.env.YTAPI_GOOGLE_CLIENT_SECRET,
  REDIRECTURLS[0] //This redirect goes to /auth/admin after google sign in
);

//route done
router.get("/", (req, res) => {
  //Checks if app is authorized
  if (!fs.existsSync(TOKEN_PATH)) {
    //Authorize the app to use your google account for youtube uploads.
    const url = generateGoogleAuthUrl(SCOPES);

    //This is the generated view
    //After signing in to google, it redirects to /auth/admin
    return res.send(`
      <p>No channel is signed in.</p>
      <p>Authorize this app by signing in to your google account.</p>
      <p>The app will upload all videos to your account's youtube channel.</p><br>
      <a href="${url}">Sign in</a>
    `);
  }

  //Continue if authorized
  //checks if the browser is opened for the first time and .credentials already exists
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    setCredentials(res);
  }

  //This is the generated view
  res.send(`
    <p><a href="/ytapi"> Home </a></p>
    <p><a href="/ytapi/channel"> View channel </a></p>
    <p><a href="/ytapi/upload"> Upload video </a></p>
  `);
});

//route done
router.get("/channel", (req, res) => {
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    setCredentials(res);
  }
  console.log(OAUTH2CLIENT.credentials);
  getChannel(res);
});

router.get("/upload", (req, res) => {
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    setCredentials(res);
  }
  res.send(`
    <a href="ytapi">Home</a>
    <h3>Upload file</h3>
    <form 
      action="/ytapi/upload" 
      method="post"
      encType="multipart/form-data"
      >
      <input type="file" name="target_video" accept="video/*" />
      <input type="submit" value="upload" />
    </form>
  `);
});

router.post("/upload", async (req, res) => {
  const video = req.files ? req.files.target_video : "";
  if (!video)
    return res.send(`
    <p>No video uploaded.</p>
    <a href="/ytapi">Home</a>
    <a href="/ytapi/upload">Back to upload</a>
  `);
  const response = await uploadVideo(
    "samptitle5",
    "sampdescription",
    ["tag1", "tag2"],
    video.tempFilePath
  );
  fs.unlinkSync(video.tempFilePath);
  // console.log("responsible", response);
  if (response.errors) return res.send("Upload error ");
  res.send(`
    Video uploaded Successfully.
    ${response}
  `);
});

//route done
router.get("/auth/admin", async (req, res) => {
  const code = decodeURIComponent(req.query.code);
  if (code) {
    try {
      const response = await OAUTH2CLIENT.getToken(code);
      const token = response.tokens;
      OAUTH2CLIENT.credentials = token;
      storeToken(token);
    } catch (ex) {
      res.send("Error while trying to retrieve access token.");
      return console.log("Error while trying to retrieve access token.", ex);
    }
  }
  res.redirect("/ytapi");
});

function generateGoogleAuthUrl(scope) {
  return OAUTH2CLIENT.generateAuthUrl({
    prompt: "consent",
    access_type: "offline",
    scope,
  });
}

function setCredentials(res) {
  try {
    const token = fs.readFileSync(TOKEN_PATH);
    OAUTH2CLIENT.credentials = JSON.parse(token);
  } catch (ex) {
    console.log("Error reading file.", ex);
    res.status(500).send("Internal server error.");
  }
}

function storeToken(token) {
  console.log("store token");
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != "EEXIST") {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log("Token stored to " + TOKEN_PATH);
  });
}

function getChannel(res) {
  const service = google.youtube("v3");
  service.channels.list(
    {
      auth: OAUTH2CLIENT,
      part: "snippet,contentDetails,statistics",
      // forUsername: "GoogleDevelopers",
      mine: true,
    },
    (err, response) => {
      if (err) return res.send("The API returned an error: " + err);

      const channels = response.data.items;
      if (channels.length == 0) return res.send("No channel found.");

      res.send(`
          <a href="/ytapi">Home</a>
          <p>This channel's id is ${channels[0].id}</p> 
          <p>with title ${channels[0].snippet.title}</p> 
          <p>and has ${channels[0].statistics.viewCount}
          views.</p>
          <a
          href="https:/youtube.com/channel/${channels[0].id}"
          target="_blank"
          rel="noopener noreferrer"
          >
          Visit channel</a>
        `);
    }
  );
}

async function uploadVideo(title, description, tags, videoFilePath) {
  const service = google.youtube("v3");
  try {
    const returnValue = await service.videos.insert({
      auth: OAUTH2CLIENT,
      part: "snippet,status",
      requestBody: {
        snippet: {
          title,
          description,
          tags,
        },
        status: {
          privacyStatus: "private",
        },
      },
      media: {
        body: fs.createReadStream(videoFilePath),
      },
    });
    return returnValue.data;
  } catch (ex) {
    console.log(ex);
    return ex;
  }
}

module.exports = router;
