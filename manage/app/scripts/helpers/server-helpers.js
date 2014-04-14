/* global define */
(function() {
    'use strict';
    var __split = String.prototype.split;
    define(['lodash', 'helpers/grain-helpers'], function(_, grainHelpers) {

        function makeFunctions($scope, $rootScope, $log, $timeout, ServerService, KeyService, $modal) {
            function refreshKeys() {
                $log.debug('refreshing keys');
                KeyService.getList().then(function(minions) {
                    $scope.minionsCounts = {
                        total: minions.length
                    };
                    var extract = _.reduce(_.sortBy(minions, function(m) {
                        return m.id;
                    }), function(results, minion) {
                        var shortName = _.first(__split.call(minion.id, '.'));
                        results[minion.id] = {
                            id: minion.id,
                            status: minion.status,
                            shortName: shortName,
                            label: 'ACCEPT'
                        };
                        return results;
                    }, {});
                    var all = $scope.cols;
                    var collection = _.reduce(_.flatten(all), function(result, minion) {
                        var entry = result.add[minion.id];
                        if (entry) {
                            // key exists still
                            delete result.add[minion.id];
                            if (entry.status !== minion.status) {
                                // minion key has changed status
                                minion.status = entry.status;
                                result.change[minion.id] = minion;
                            }
                        } else {
                            // key has been removed
                            result.remove[minion.id] = true;
                        }
                        return result;
                    }, {
                        add: extract,
                        change: {},
                        remove: {}
                    });
                    if (!_.isEmpty(collection.remove)) {
                        // remove hosts
                        all = _.map(all, function(col) {
                            return _.filter(col, function(minion) {
                                return !(collection.remove[minion.id]);
                            });
                        });
                    }
                    if (!_.isEmpty(collection.change)) {
                        all = _.map(all, function(col) {
                            return _.map(col, function(minion) {
                                if (collection.change[minion.id]) {
                                    return collection.change[minion.id];
                                }
                                return minion;
                            });
                        });
                    }
                    var adds = _.map(collection.add, function(value) {
                        return value;
                    });
                    _.each(adds, function(add) {
                        // add hosts
                        var col = _.reduce(_.rest(all), function(result, col) {
                            if (result.length <= col.length) {
                                return result;
                            } else {
                                return col;
                            }
                        }, _.first(all));
                        col.push(add);
                    });
                    $scope.cols = all;
                });
                $rootScope.keyTimer = $timeout(refreshKeys, 20000);
            }

            function acceptMinion(colnum, minion) {
                minion.label = '<i class="fa fa-spinner fa-spin"></i>';
                KeyService.accept([minion.id]).then(function( /*resp*/ ) {
                    /* Do nothing - refresh code will handle UI updates */
                }, function(resp) {
                    var modal = $modal({
                        template: 'views/custom-modal.html',
                        html: true
                    });
                    modal.$scope._hide = function() {
                        modal.$scope.$hide();
                    };
                    if (resp.status === 403) {
                        modal.$scope.title = '<i class="text-danger fa fa-exclamation-circle fa-lg"></i> Unauthorized Access';
                        modal.$scope.content = 'Error ' + resp.status + '. Please try reloading the page and logging in again.</p>';
                    } else {
                        modal.$scope.title = '<i class="text-danger fa fa-exclamation-circle fa-lg"></i> Unexpected Error';
                        modal.$scope.content = '<i class="text-danger fa fa-exclamation-circle fa-lg"></i> Error ' + resp.status + '. Please try reloading the page and logging in again.</p><h4>Raw Response</h4><p><pre>' + resp.data + '</pre></p>';
                    }
                });
            }

            function detailView(id) {
                var modal = $modal({
                    title: id,
                    template: 'views/detail-grains-modal.html',
                    show: true
                });
                // TODO need a special path for the calamari server itself using /grains
                ServerService.getGrains(id).then(function(data) {
                    /* jshint camelcase: false */
                    data.cpu_flags = grainHelpers.formatCpuFlags(data.cpu_flags);
                    data.ipv4 = grainHelpers.formatIPAddresses(data.ipv4);
                    data.ipv6 = grainHelpers.formatIPAddresses(data.ipv6);
                    data.ip_interfaces = grainHelpers.formatInterfaces(data.ip_interfaces);
                    var pairs = _.map([
                            'lsb_distrib_description',
                            'osarch',
                            'kernelrelease',
                            'saltversion',
                            'cpu_model',
                            'num_cpus',
                            'cpu_flags',
                            'mem_total',
                            'ip_interfaces',
                            'ipv4',
                            'ipv6'
                    ], function(key) {
                        return {
                            key: key,
                            value: data[key] || 'Unknown'
                        };
                    });
                    modal.$scope.pairs = pairs;
                });
            }
            /* servers --- end */
            return {
                refreshKeys: refreshKeys,
                detailView: detailView,
                acceptMinion: acceptMinion
            };
        }
        return {
            makeFunctions: makeFunctions
        };
    });
})();