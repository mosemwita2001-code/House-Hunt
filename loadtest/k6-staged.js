import http from 'k6/http';
import { check, sleep } from 'k6';

// Local/staging only. Example: k6 run -e BASE_URL=http://localhost:5000/api loadtest/k6-staged.js
const baseUrl = __ENV.BASE_URL || 'http://localhost:5000/api';
const stages = [10, 25, 50, 100, 250, 500].map(target => ({ duration: '1m', target }));

export const options = {
  stages: [...stages, { duration: '2m', target: 500 }, { duration: '1m', target: 0 }],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/properties?limit=24`);
  check(response, { 'properties endpoint returns 200': res => res.status === 200 });
  sleep(1);
}
