#!/bin/bash
#update .env flag to disable https
sed -i "" 's/true/false/g' ../../../../.env
echo "Disabled HTTPS"