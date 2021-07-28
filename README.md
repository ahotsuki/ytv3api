# Automated youtube upload app

## Using Youtube API V3

The app is based on this guide: [https://developers.google.com/youtube/v3/quickstart/nodejs]

The provided link above also contains an instruction to activate the youtube api in this link: [https://console.developers.google.com/start/api?id=youtube]

---

## To setup the youtube api

After setting up the OAuth consent screen

1. Select **Credentials** tab, and click **Create credentials** button and select **OAuth client ID**.
1. Select the type to be **Web Application**.
1. Add a Javascript origin: **http://localhost:5000** since the app runs on port 5000.
1. Add an authorize redirect URI: **http://localhost:5000/ytapi/auth/admin**

---

## To setup the app

1. Download the client_secret.json from the previously created credential.
1. Put the **client_id**, **client_secret**, and **redirect_uri** from the **client_secret.json** to the **.env** file.
1. run `npm i`
1. run the app with
   `npm run dev` with nodemon or `npm start`.
1. When prompted to authorize the app at first, sign in with your google account. All videos will be uploaded to that account.
