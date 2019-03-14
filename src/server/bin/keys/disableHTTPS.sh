#!/bin/bash
unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)
        sed -i "s/USE_HTTPS=true/USE_HTTPS=false/g" ../../../../.env
        ;;

    Darwin*)
        #update .env flag to disable https
        sed -i "" "s/USE_HTTPS=true/USE_HTTPS=false/g" ../../../../.env
        ;;
    *)
            echo "Unknown platform." >&2
            ;;
esac

echo "Disabled HTTPS"
