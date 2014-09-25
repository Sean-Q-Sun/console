angular.module('app')

/**
 * multi-container input directive form.
 */
.directive('coMultiContainerInput', function(_, arraySvc, PodsSvc, EVENTS) {

  'use strict';

  return {
    templateUrl: '/static/module/container/multi-container-input.html',
    restrict: 'E',
    replace: true,
    scope: {
      pod: '='
    },
    controller: function($scope) {

      $scope.$on(EVENTS.CONTAINER_REMOVE, function(e, container) {
        $scope.removeContainer(container);
        e.stopPropagation();
      });

      $scope.removeContainer = function(c) {
        if ($scope.containers.length === 1) {
          $scope.containers = [PodsSvc.getEmptyContainer()];
        } else {
          arraySvc.remove($scope.containers, c);
        }
      };

      $scope.addContainer = function() {
        $scope.containers.push(PodsSvc.getEmptyContainer());
      };

      $scope.$watch('pod', function(p) {
        if (!p || !p.desiredState || !p.desiredState.manifest) {
          return;
        }
        if (_.isEmpty(p.desiredState.manifest.containers)) {
          p.desiredState.manifest.containers = [PodsSvc.getEmptyContainer()];
        }
        // shorter alias
        $scope.containers = p.desiredState.manifest.containers;
      });
    }
  };

})
/**
 * single-container input directive form.
 */
.directive('coContainerInput', function(_, ModalLauncherSvc, EVENTS) {

  'use strict';

  return {
    templateUrl: '/static/module/container/container-input.html',
    restrict: 'E',
    replace: true,
    scope: {
      // container object to bind to
      container: '=',
      // pod volumes to use for container volume mount selection
      podVolumes: '=',
      // render with 'remove' icon, default is false
      enableRemove: '@',
    },
    controller: function($scope) {

      function updateImage(image, tag) {
        var t;
        t = tag || $scope.fields.containerTag;
        $scope.container.image = (image || $scope.fields.containerImage) + ':' + (t || 'latest');
      }

      function getEmptyFields() {
        return {
          containerImage: '',
          containerTag: 'latest',
        };
      }

      function updateImageFields(image) {
        var parts;
        if (!image) {
          $scope.fields = getEmptyFields();
          return;
        }
        parts = image.split(':');
        if (parts.length > 0) {
          $scope.fields.containerImage = parts[0];
        }
        if (parts.length > 1) {
          $scope.fields.containerTag = parts[1];
        } else {
          $scope.fields.containerTag = 'latest';
        }
      }

      $scope.fields = getEmptyFields();

      $scope.openPortsModal = function() {
        ModalLauncherSvc.open('configure-ports', {
          container: $scope.container
        });
      };

      $scope.openEnvModal = function() {
        ModalLauncherSvc.open('configure-env', {
          container: $scope.container
        });
      };

      $scope.openVolumeMountsModal = function() {
        ModalLauncherSvc.open('configure-volume-mounts', {
          container: $scope.container,
          volumes: $scope.podVolumes
        });
      };

      $scope.remove = function() {
        $scope.$emit(EVENTS.CONTAINER_REMOVE, $scope.container);
      };

      $scope.$watch('container.image', updateImageFields);

      $scope.$watch('fields.containerImage', function(image) {
        if (image) {
          updateImage(image, null);
        }
      });

      $scope.$watch('fields.containerTag', function(tag) {
        if (tag) {
          updateImage(null, tag);
        }
      });

    }
  };

});