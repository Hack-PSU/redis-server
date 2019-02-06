#!/bin/bash
#update .env flag to disable https
sed -i "" 's/USE_HTTPS=true/USE_HTTPS=false/g' ../../../../.env
echo "Disabled HTTPS"