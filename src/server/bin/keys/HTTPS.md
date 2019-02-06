## Enable HTTPS
1. Find the file `enableHTTPS.sh` located in this directory
1. Near the top of the file, you'll find this line: `PASSPHRASE="change_me"`
1. Change the `change_me` to a password that you'd like
1. Make sure `enableHTTPS.sh` is executable
    1. If it isn't run: `chmod 755 enableHTTPS.sh ` in the directory
1. Run enableHTTPS.sh: `./enableHTTPS.sh`
1. Fill out and answer all the questions it asks. WARNING: MAKE SURE YOU PUT `*` for the `Common Name`
1. Save the fingerprint for verifying Redis identity on Scanners

## Disable HTTPS
1. Find the file `disableHTTPS.sh` located in this directory
1. Make sure `disableHTTPS.sh` is executable.
    1. If it isn't run: `chmod 755 disableHTTPS.sh ` in the directory
1. Run enableHTTPS.sh: `./disableHTTPS.sh`