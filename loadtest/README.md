# Staged load test

Run only against a local or staging environment:

`k6 run -e BASE_URL=http://localhost:5000/api loadtest/k6-staged.js`

The scenario ramps through 10, 25, 50, 100, 250, and 500 virtual users. It does not submit forms, create payments, or target production.
