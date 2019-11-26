

$(document).ready(function() {



    $('[id^=delete-scanner-form]').submit(function(event) {
        event.preventDefault();
        $('#product-response').text('');
        let payload = {};
        let scannerID = this.id;
        let index = scannerID.indexOf(":") + 1;
        scannerID = scannerID.substring(index);
        let url = '/api/scanners/' + scannerID;
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
                $('#product-response').text('Yike! Removing Something went wrong.');
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
          .fail(function(err) {
              console.error(JSON.stringify(err));
              $('#product-response').text('Yikes! Removing something went wrong.');
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
