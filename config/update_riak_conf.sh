#!/bin/bash

if [ -z "${RIAK_HOME}" ]; then
    echo 'Please specify $RIAK_HOME'
    exit -1
fi  

if [ ! -e "${RIAK_HOME}" ]; then
    echo "\$RIAK_HOME '$RIAK_HOME' not found."
    exit -1
fi

set -x

RIAK_STORAGE_BACKEND=riak_kv_eleveldb_backend

perl -i.bak \
    -pe "s/{storage_backend,.*}/{storage_backend, $RIAK_STORAGE_BACKEND}/;" \
    -0pe 's/({riak_search,.+\n.*\n.*){enabled,[^}]+}/$1\{enabled, true}/g;' \
    $RIAK_HOME/etc/app.config

$RIAK_HOME/bin/riak restart
