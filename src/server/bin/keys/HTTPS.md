## Enable HTTPS

1. Generate an SSL certificate (must be self-signed if hosting locally)
    ```sh
    # generate private key and enter pass phrase
    openssl genrsa -des3 -out private_key.pem 2048
    
    # create certificate signing request, enter "*" as a "Common Name", leave "challenge password" blank
    openssl req -new -sha256 -key private_key.pem -out server.csr
    
    # generate self-signed certificate for 1 year
    openssl req -x509 -sha256 -days 365 -key key.pem -in server.csr -out cert.pem
    
    # validate the certificate
    openssl req -in server.csr -text -noout | grep -i "Signature.*SHA256" && echo "All is well" || echo "This certificate doesn't work in 2017! You must update OpenSSL to generate a widely-compatible certificate"

    ```
1. Copy the cert.pem and key.pem files to the `src/server/bin/keys/` directory.
1. Open the `src/server/bin/www` file.
    1. Uncomment the `Create HTTPS server.` section
    1. Comment the `Create HTTP server.` section
1. Get the fingerprint of the certificate: `openssl x509 -noout -in cert.pem -fingerprint`
1. Save the fingerprint for verifying Redis identity on Scanners.
TODO: make script for this