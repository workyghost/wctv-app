import http from 'http';
import https from 'https';

console.log("=== RUNNING DOKPLOY WEBHOOK DIAGNOSTIC ===");

const postData = JSON.stringify({
  ref: "refs/heads/main",
  repository: {
    clone_url: "https://github.com/workyghost/wctv-app.git"
  }
});

const testEndpoint = (url, isHttps) => {
  return new Promise((resolve) => {
    console.log(`Testing URL: ${url}`);
    const client = isHttps ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'GitHub-Hookshot/eccb382'
      }
    }, (res) => {
      console.log(`URL: ${url} -> Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Response body: ${data}`);
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`URL: ${url} -> Error: ${e.message}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
};

async function run() {
  // Test local docker network endpoint
  await testEndpoint('http://dokploy:3000/api/deploy/bvMvWy-zMeobe-_JpCwAE', false);
  
  // Test public secure endpoint
  await testEndpoint('https://dokploy.workyghost.com/api/deploy/bvMvWy-zMeobe-_JpCwAE', true);
  
  console.log("=== DIAGNOSTIC COMPLETE ===");
}

run();
