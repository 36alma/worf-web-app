import PostsFeed from '@/components/posts/PostsFeed';

interface GroupPostsPageProps {
  params: Promise<{groupId: string}>;
}

export default async function GroupPostsPage({params}: GroupPostsPageProps) {
  const {groupId} = await params;
  return <PostsFeed mode="group" groupId={groupId} />;
}
