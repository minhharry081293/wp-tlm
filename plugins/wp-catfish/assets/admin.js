(function ($) {
  'use strict';

  function bindRow($row) {
    $row.find('.wpcf-pick').on('click', function (e) {
      e.preventDefault();
      var $btn = $(this);
      var $wrap = $btn.closest('.wpcf-media');
      var frame = wp.media({
        title: wpcfAdmin.i18n.title,
        button: { text: wpcfAdmin.i18n.select },
        library: { type: 'image' },
        multiple: false,
      });
      frame.on('select', function () {
        var att = frame.state().get('selection').first().toJSON();
        var url = (att.sizes && att.sizes.medium && att.sizes.medium.url) || att.url;
        $wrap.find('.wpcf-image-id').val(att.id);
        $wrap.find('.wpcf-preview').html('<img src="' + url + '" alt="" />');
        $btn.text(wpcfAdmin.i18n.change);
        $wrap.find('.wpcf-clear').show();
      });
      frame.open();
    });

    $row.find('.wpcf-clear').on('click', function (e) {
      e.preventDefault();
      var $wrap = $(this).closest('.wpcf-media');
      $wrap.find('.wpcf-image-id').val('0');
      $wrap.find('.wpcf-preview').html('<span class="wpcf-placeholder">Chưa chọn ảnh</span>');
      $wrap.find('.wpcf-pick').text(wpcfAdmin.i18n.select);
      $(this).hide();
    });

    $row.find('.wpcf-remove-row').on('click', function (e) {
      e.preventDefault();
      var $tbody = $('#wpcf-rows tbody');
      if ($tbody.find('.wpcf-row').length <= 1) {
        $row.find('.wpcf-clear').trigger('click');
        $row.find('input[name="url[]"]').val('');
        return;
      }
      $row.remove();
    });
  }

  $(function () {
    $('#wpcf-rows tbody .wpcf-row').each(function () {
      bindRow($(this));
    });

    $('#wpcf-add-row').on('click', function () {
      var $tbody = $('#wpcf-rows tbody');
      if ($tbody.find('.wpcf-row').length >= wpcfAdmin.max) {
        alert('Tối đa ' + wpcfAdmin.max + ' banner');
        return;
      }
      var html = $('#wpcf-row-template').html();
      var $row = $(html);
      $tbody.append($row);
      bindRow($row);
    });
  });
})(jQuery);
