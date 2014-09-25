angular.module('app')
.controller('ConfigureEnvCtrl', function(_, $scope, $modalInstance, $controller,
      $rootScope, container, PodsSvc) {
  'use strict';

  $scope.rowMgr = $controller('RowMgr', {
    $scope: $rootScope.$new(),
    emptyCheck: function(e) {
      return _.isEmpty(e.name) || _.isEmpty(e.value);
    },
    getEmptyItem: PodsSvc.getEmptyEnvVar,
  });

  $scope.initEnvVars = function(envVars) {
    if (_.isEmpty(envVars)) {
      $scope.rowMgr.setItems([]);
    } else {
      $scope.rowMgr.setItems(angular.copy(envVars));
    }
  };

  $scope.save = function() {
    container.env = $scope.rowMgr.getNonEmptyItems();
    $modalInstance.close(container);
  };

  $scope.cancel = function() {
    $modalInstance.dismiss('cancel');
  };

  $scope.initEnvVars(container.env);
})
.controller('ConfigureEnvFormCtrl', function($scope) {
  $scope.submit = $scope.save;
});