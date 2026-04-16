# charles-schwab-algorithmic-trading
<img width="1253" height="738" alt="Screenshot 2026-04-16 131911" src="https://github.com/user-attachments/assets/d4f7cc3f-d327-4b68-b6a1-41e860f1c5ff" />
<img width="1228" height="718" alt="Screenshot 2026-04-16 131932" src="https://github.com/user-attachments/assets/4b347e57-6ce7-460b-ba3a-139fbf32c839" />
<img width="1573" height="754" alt="Screenshot 2026-04-16 132000" src="https://github.com/user-attachments/assets/e5e13fe9-0f83-4db6-bc53-773aa7905990" />

## Install
* Create optional file 'credentials.js' in '\server\config\environment\credentials.js'
```
export default {
    port: 9000,
    armadilloUrl: 'http://localhost:3000/', // Machine Learning service local address https://github.com/Artimatic/station-analysis-service
};

```

Run `npm install` or `npm ci`

## Build

Run `npm run build `.

## Start Server

Run `npm run start`

## Local Address

http://127.0.0.1:9000/

#### Machine Learning functionalities

Requires station-analysis-service to be set up and running. https://github.com/Artimatic/station-analysis-service

