

$(document).ready(function() {



    $('[id^=delete-scanner-form]').submit(function(event) {
        event.preventDefault();
        $('#product-response').text('');
        var payload = {};
        var index = this.id;
        index = index.substring(19);
        var url = '/api/scanners/' + index;
        $.ajax({
            type: 'DELETE',
            url: url,
            data: payload
        })
            .done(function(data) {
                $("#scanners").load( "scanners #scanners" );
                //$('#product-response').text('Yay! Product Removed!');
            })
            .fail(function() {
                $('#product-response').text('Yike! Remvoing Something went wrong.');
            });
        $('#product-name').val('');
        $('#product-price').val('');
    });

    $('#add-scanner-form').submit(function(event) {
        event.preventDefault();
        $('#product-response').text('');
        var payload = {};
        var url = '/api/scanners/';
        $.ajax({
            type: 'POST',
            url: url,
            data: payload
        })
          .done(function(result) {
              //$("#scanners").html(ajax_load).load(loadUrl);
              $("#scanners").load( "scanners #scanners" );
              //$('#product-response').text('Created New Scanner!');

          })
          .fail(function() {
              $('#product-response').text('Yike! Remvoing Something went wrong.');
          });
        $('#product-name').val('');
        $('#product-price').val('');
    });



    $('#buy-item-form').submit(function(event) {
        var $form = $(this);
        $form.find('button').prop('disabled', true);
        $form.get(0).submit();
    });

});
