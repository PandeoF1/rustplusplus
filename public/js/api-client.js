// API Client for RustPlus WebUI

class APIClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    async get(endpoint) {
        const response = await fetch(this.baseUrl + endpoint);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        return await response.json();
    }

    async post(endpoint, data) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        return await response.json();
    }
}
