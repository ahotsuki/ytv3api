const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const router = require("express").Router();

// If modifying these scopes, delete the previously saved credentials
// at __dirname/.credentials
// scopes are only set to youtube.readonly, youtube.upload
// these scopes help retrieve channel data and upload videos
const SCOPES = process.env.YTAPI_MAIN_SCOPES.split(" ");

const TOKEN_DIR = path.join(__dirname, process.env.YTAPI_TOKEN_DIR);
const TOKEN_PATH = path.join(TOKEN_DIR, process.env.YTAPI_TOKEN_FILE);

const OAUTH2CLIENT = new OAuth2(
  process.env.YTAPI_GOOGLE_CLIENT_ID,
  process.env.YTAPI_GOOGLE_CLIENT_SECRET,
  process.env.YTAPI_GOOGLE_REDIRECT_URL
);

router.get("/", (req, res) => {
  // Checks if app is authorized
  if (!fs.existsSync(TOKEN_PATH)) {
    // Authorize the app to use your
    // google account for youtube uploads.
    const url = generateGoogleAuthUrl(SCOPES);

    // Sends the url to authorize the app
    return res.send(`
      <p>No channel is signed in.</p>
      <p>Authorize this app by signing in to your google account.</p>
      <p>The app will upload all videos to your account's youtube channel.</p><br>
      <a href="${url}">Sign in</a>
    `);
  }

  // Continue if authorized
  // Checks if credentials are unset
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    setCredentials(res);
  }

  res.send(`
    <p><a href="/ytapi"> Home </a></p>
    <p><a href="/ytapi/channel"> View channel </a></p>
    <p><a href="/ytapi/upload"> Upload video </a></p>
  `);
});

router.get("/channel", (req, res) => {
  // Checks if credentials are unset
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    return res.redirect("/ytapi");
  }

  getChannel(res);
});

router.get("/upload", (req, res) => {
  if (Object.keys(OAUTH2CLIENT.credentials).length === 0) {
    return res.redirect("/ytapi");
  }

  res.send(`
    <a href="ytapi">Home</a>
    <h3>Upload file</h3>
    <form 
      action="/ytapi/upload" 
      method="post"
      encType="multipart/form-data"
      >
      <input type="text" name="title" placeholder="title" required />
      <input type="text" name="description" placeholder="description" required />
      <input type="text" name="tags" placeholder="tags" required />
      <p>Note: Please separate the tags with commas. (i.e. Funny, Amazing, etc.)</p>
      <input type="file" name="target_video" accept="video/*" required />
      <input type="submit" value="upload" />
    </form>
  `);
});

router.post("/upload", async (req, res) => {
  const { title, description } = req.body;
  const tags = req.body.tags.split(",");
  const video = req.files ? req.files.target_video : "";

  if (!video)
    return res.send(`
    <p>No video uploaded.</p>
    <a href="/ytapi">Home</a>
    <a href="/ytapi/upload">Back to upload</a>
  `);

  const response = await uploadVideo(
    title,
    description,
    tags,
    video.tempFilePath
  );

  // Removes video in tmp folder after upload
  fs.unlinkSync(video.tempFilePath);

  if (response.errors) return res.send("Upload error!");

  res.send(`
    Video uploaded Successfully.
    <a href="/ytapi/channel" > View Channel </a>
  `);
});

// Redirect endpoint after signing in to google
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

async function getChannel(res) {
  const service = google.youtube("v3");

  try {
    const response = await service.channels.list({
      auth: OAUTH2CLIENT,
      part: "snippet,contentDetails,statistics",
      mine: true,
    });

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
  } catch (error) {
    console.log("The api returned an error. ", error);
    res.send("The api returned an error.");
  }
}

async function uploadVideo(title, description, tags, videoFilePath) {
  const service = google.youtube("v3");

  try {
    const response = await service.videos.insert({
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
          // video set to private for testing
        },
      },
      media: {
        body: fs.createReadStream(videoFilePath),
      },
    });

    return response.data;
  } catch (ex) {
    console.log(ex);
    return ex;
  }
}

module.exports = router;
