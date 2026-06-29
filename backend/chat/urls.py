from django.urls import path
from . import views

urlpatterns = [
    path('users/', views.ChatUserListView.as_view(), name='chat-users'),
    path('conversations/', views.ConversationListView.as_view(), name='chat-conversations'),
    path('dm/<int:user_id>/messages/', views.DMHistoryView.as_view(), name='chat-dm-history'),
    path('groups/', views.GroupListCreateView.as_view(), name='chat-groups'),
    path('groups/<int:pk>/', views.GroupDetailView.as_view(), name='chat-group-detail'),
    path('groups/<int:group_id>/messages/', views.GroupMessageListView.as_view(), name='chat-group-messages'),
    path('groups/<int:group_id>/members/', views.GroupMemberAddView.as_view(), name='chat-group-add-member'),
    path('groups/<int:group_id>/members/<int:user_id>/', views.GroupMemberRemoveView.as_view(), name='chat-group-remove-member'),
    path('search/', views.MessageSearchView.as_view(), name='chat-search'),
]
